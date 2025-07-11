import mongoose, { Document, Schema, Model } from "mongoose";
import shortid from "shortid";

export interface IRoom extends Document {
  roomId: string,
  roomName: string,
  creatorId: mongoose.Types.ObjectId,
  creatorFirebaseUid: string,
  currentCode: string,
  language: string,
  participants: { 
    userId: mongoose.Types.ObjectId;
    socketId: string;
    firebaseUid: string;
    displayName: string; 
  }[];
  createdAt: Date,
  updatedAt: Date
}

const RoomSchema: Schema = new Schema<IRoom>({
  roomId: {
    type: String,
    unique: true,
    required: true,
    default: shortid.generate,
  },
  roomName: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 100,
  },
  creatorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  creatorFirebaseUid: {
    type: String,
    required: true,
  },
  currentCode: {
    type: String,
    default: '// Start coding here...',
  },
  language: {
    type: String,
    default: 'javascript',
  },
  participants : [{
    userId: {type: Schema.Types.ObjectId, ref: 'User' },
    socketId: { type: String },
    firebaseUid: { type: String },
    displayName: { type: String }
  }]
},{ timestamps: true });

const Room: Model<IRoom> = mongoose.model<IRoom>('Room', RoomSchema);
export default Room;