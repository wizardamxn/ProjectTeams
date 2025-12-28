import {configureStore} from '@reduxjs/toolkit'
import userReducer from '@/store/slices/User'
import chatReducer from '@/store/slices/SocketThunks'

export const store = configureStore({
    reducer:{
        user: userReducer,
        chat: chatReducer
    }
})