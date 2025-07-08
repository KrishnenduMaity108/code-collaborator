import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IUser extends Document {
  firebaseUid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema<IUser>({
  firebaseUid: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: false
  },
  photoURL: {
    type: String,
    required: false
  } ,
}, { timestamps: true });

const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
export default User;