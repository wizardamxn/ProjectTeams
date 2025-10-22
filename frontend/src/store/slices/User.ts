import { createSlice } from "@reduxjs/toolkit";

const userSlice = createSlice({
    name:"user",
    initialState: {
    user: null, // now it's an object, not null
  },
    reducers: {
        addUser : (state,action) => {
            state.user = action.payload
        }
    }
})


export const {addUser} = userSlice.actions

export default userSlice.reducer