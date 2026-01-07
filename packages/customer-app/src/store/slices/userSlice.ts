import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
}

interface UserState {
  user: User | null;
  isGuest: boolean;
  lastSynced: number | null;
}

const initialState: UserState = {
  user: null,
  isGuest: false,
  lastSynced: null,
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.lastSynced = Date.now();
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        state.lastSynced = Date.now();
      }
    },
    setGuest: (state, action: PayloadAction<boolean>) => {
      state.isGuest = action.payload;
    },
  },
});

export const { setUser, updateUser, setGuest } = userSlice.actions;

export default userSlice.reducer;
