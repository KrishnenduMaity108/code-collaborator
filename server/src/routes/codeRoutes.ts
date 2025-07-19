// server/src/routes/codeRoutes.ts
import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { execa } from 'execa'; // For running external commands (Docker)
import * as admin from 'firebase-admin'; // For Firebase user authentication
import path from 'path';        // For handling file paths
import fs from 'fs/promises';   // For asynchronous file system operations
import os from 'os';            // For getting the temporary directory
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

const router = Router();

// Define an interface for authenticated requests
interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

// Mapping of language names to their corresponding Docker image tags
const languageDockerImages: { [key: string]: string } = {
  javascript: 'code-runner-javascript',
  python: 'code-runner-python',
  java: 'code-runner-java',
  cpp: 'code-runner-cpp',
  c: 'code-runner-cpp',
  // Add more languages and their image tags as you build their Dockerfiles
};

// Configuration for each language: how to save the file and what command to run
const languageExecConfig: { [key: string]: { filename: (uuid: string) => string, command: (filePathInContainer: string, fileUUID: string) => string[] } } = {
  javascript: {
    filename: (uuid) => `${uuid}.js`,
    command: (filePathInContainer) => {
      // Now, filePathInContainer will be like `/app/YOUR_UUID.js`
      return ['node', filePathInContainer];
    }
  },
  python: {
    filename: (uuid) => `${uuid}.py`,
    command: (filePathInContainer) => {
      return ['python3', filePathInContainer];
    }
  },
  java: { // Java requires compilation first, then execution
    filename: () => `Main.java`, // Always save as Main.java for simplicity
    command: (filePathInContainer, fileUUID) => {
      // Assuming filePathInContainer is /app/Main.java
      const className = "Main";
      return ['sh', '-c', `javac ${filePathInContainer} && java -cp /app ${className}`]; // Add -cp /app for class path
    }
  },
  cpp: { // C++ requires compilation, then execution of the binary
    filename: (uuid) => `${uuid}.cpp`,
    command: (filePathInContainer, fileUUID) => {
      const executableName = `${fileUUID}_exec`;
      const executablePathInContainer = `/app/${executableName}`;
      return ['sh', '-c', `g++ ${filePathInContainer} -o ${executablePathInContainer} && ${executablePathInContainer}`];
    }
  },
  c: { // C also requires compilation, then execution of the binary
    filename: (uuid) => `${uuid}.c`,
    command: (filePathInContainer, fileUUID) => {
      const executableName = `${fileUUID}_exec`;
      const executablePathInContainer = `/app/${executableName}`;
      return ['sh', '-c', `gcc ${filePathInContainer} -o ${executablePathInContainer} && ${executablePathInContainer}`];
    }
  }
};

// Helper function to normalize Windows paths for Docker mounts
function normalizeWindowsPathForDocker(windowsPath: string): string {
  // Replace backslashes with forward slashes
  let normalizedPath = windowsPath.replace(/\\/g, '/');
  // If it's a Windows drive letter path (e.g., C:/...), convert to /c/...
  if (normalizedPath.length > 2 && normalizedPath[1] === ':' && normalizedPath[0].match(/[a-zA-Z]/)) {
    normalizedPath = `/${normalizedPath[0].toLowerCase()}${normalizedPath.substring(2)}`;
  }
  return normalizedPath;
}


router.post('/run', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { code, language, input } = req.body;
  const firebaseUid = req.user?.uid;

  // 1. Basic Validation
  if (!firebaseUid) {
    res.status(401).json({ message: 'Unauthorized: User not authenticated.' });
    return;
  }

  const dockerImage = languageDockerImages[language];
  const execConfig = languageExecConfig[language];

  if (typeof code !== 'string' || !language || !dockerImage || !execConfig) {
    res.status(400).json({ message: 'Invalid code, unsupported language, or missing configuration.' });
    return;
  }

  let output = '';
  let errorOutput = '';
  let hostTempFilePath = ''; // Path to the temporary file on the host machine
  const fileUUID = uuidv4(); // Unique ID for this execution's files

  const hostTempDir = os.tmpdir(); // System's temporary directory (e.g., /tmp on Linux)
  const containerAppDir = '/app'; // Standard working directory inside our Docker images

  try {
    // 2. Prepare Temporary Code File on Host
    const filename = execConfig.filename(fileUUID);
    // The actual path to the file on the host within the temp directory
    hostTempFilePath = path.join(hostTempDir, filename);

    // Write the user's code to the temporary file
    await fs.writeFile(hostTempFilePath, code);

    // No need for fs.realpath on the file itself if mounting the directory
    // fs.realpath is for canonicalizing a file path, not changing how Docker interprets a mount source.

    console.log(`Code written to host temp file: ${hostTempFilePath}`);


    // 3. Construct Docker Command and Arguments
    // Mount the *entire temporary directory* from the host to /app in the container
    const normalizedHostTempDir = normalizeWindowsPathForDocker(hostTempDir);
    const bindMountArg = `${normalizedHostTempDir}:${containerAppDir}`; // Mount the temp directory

    // The path to the code file *inside the container*
    const filePathInContainer = path.join(containerAppDir, filename).replace(/\\/g, '/'); // Ensure forward slashes for container path

    const runCommandArgs = execConfig.command(filePathInContainer, fileUUID); // Command to run inside container

    const dockerArgs = [
      'run',
      '--rm',  // Automatically remove the container when it exits
      '--name', `code-run-${fileUUID}`, // Unique name for the container
      '--network', 'none', // CRITICAL: Isolate from network
      '--memory=128m', // Limit memory usage (128 MB)
      '--cpus=0.5',  // Limit CPU usage (0.5 of a core)
      '--pids-limit', '64',  // Limit number of processes
      '-v', bindMountArg,  // Mount the temporary directory
      dockerImage, // The Docker image to use (e.g., code-runner-python)
      ...runCommandArgs     // The command to execute inside the container
    ];

    console.log(`Executing: docker ${dockerArgs.join(' ')}`);

    // 4. Execute Docker Command using `execa`
    const childProcess = execa('docker', dockerArgs, {
      input: input || '',     // Pass stdin if provided by the user
      timeout: 15000,  // Timeout for the entire Docker command (5 seconds)
      killSignal: 'SIGKILL',  // Force kill if timeout occurs
      cwd: hostTempDir,  // Set working directory for execa to access temp files
      stripFinalNewline: false,   // Preserve newlines in output
    });

    // 5. Capture Output and Errors
    const { stdout, stderr } = await childProcess;
    output = stdout;
    errorOutput = stderr;

    console.log(`Execution complete for ${language} code ${fileUUID}`);
    console.log('STDOUT:', output);
    if (errorOutput) {
      console.error('STDERR:', errorOutput);
    }

    // 6. Send Response to Client
    res.status(200).json({ output, error: errorOutput });

  } catch (err: any) {
    // 7. Handle Execution Errors
    console.error(`Execution failed for ${language} code ${fileUUID}:`, err);

    if (err.timedOut) {
      errorOutput = `Execution timed out after ${err.duration / 1000} seconds. Please check for infinite loops or very long computations.`;
    } else if (err.exitCode !== undefined && err.exitCode !== 0) {
      // Process exited with a non-zero code (runtime error, compilation error, etc.)
      // err.stderr often contains the error messages from the compiler/interpreter
      errorOutput = err.stderr || err.message || `Code exited with non-zero status: ${err.exitCode}`;
    } else if (err.isCanceled) {
      errorOutput = 'Code execution was cancelled.';
    }
    else {
      // Other unexpected errors (e.g., Docker not running, image not found)
      errorOutput = err.message || 'An unexpected error occurred during execution setup.';
      if (errorOutput.includes('command not found')) {
        errorOutput += '\nEnsure Docker is running and images are built.';
      }
    }
    res.status(500).json({ output: '', error: errorOutput });

  } finally {
    // 8. Clean Up Temporary Files on Host (very important)
    if (hostTempFilePath) {
      try {
        await fs.unlink(hostTempFilePath);
        console.log(`Deleted host temp file: ${hostTempFilePath}`);
      } catch (cleanUpErr) {
        console.error(`Error deleting host temp file ${hostTempFilePath}:`, cleanUpErr);
      }
    }
  }
});

export default router;