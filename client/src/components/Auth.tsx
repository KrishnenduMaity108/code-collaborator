import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider
} from 'firebase/auth';
import { auth } from "../firebase";
import toast from "react-hot-toast";

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try{
      if(isSignUp){
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success('Sign up successful!');
      }else{
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Login successful!');
      }
    } catch(error: any){
      console.error('Authentication Error:', error.message);
      toast.error(error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Signed in with Google!');
    } catch (error: any) {
      console.error("Google Sign-In error:", error.message);
      toast.error(error.message);
    }
  };

  const handleGitHubSignIn = async () => {
    try {
      const provider = new GithubAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success("Signed in with GitHub!");
    } catch (error: any) {
      console.error("GitHub Sign-In error:", error.message);
      toast.error(error.message);
    }
  };
   
  return(
    <div className="flex flex-col items-center justify-center min-h-screan bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold mb-6 text-cyan-400">{isSignUp ? 'Sign Up' : 'Login'}</h1>

      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-gray-800 p-6 rounded-lg shadow-xl">
        <div className="mb-4">
          <label className="block text-gray-300 text-sm font-bold mb-2">
            Email
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            id="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="password">
            Password
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            id="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {/* <div className="flex items-center justify-between mb-4"> */}
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors mb-2"
            type="submit"
            >
            {isSignUp ? 'Sign Up' : 'Log In'}
          </button>
          <br></br>
          <button
            className="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800 transition-colors"
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? 'Already have an account? Log In' : 'Create an account'}
          </button>
        {/* </div> */}

        <div className="relative flex py-5 items-center">
            <div className="flex-grow border-t border-gray-600"></div>
            <span className="flex-shrink mx-4 text-gray-400">OR</span>
            <div className="flex-grow border-t border-gray-600"></div>
        </div>

        <div className="flex flex-col space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex items-center justify-center transition-colors"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" className="h-5 w-5 mr-2" />
            Sign in with Google
          </button>
          
          <button
            type="button"
            onClick={handleGitHubSignIn}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex items-center justify-center transition-colors"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/github.svg" alt="GitHub logo" className="h-5 w-5 mr-2 filter invert" />
            Sign in with GitHub
          </button>
        </div>
      </form>
    </div>
  );
};

export default Auth;