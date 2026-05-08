import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import ShowPage from './components/ShowPage'
import ForgotPassword from './components/ForgotPassword'
import ResetPassword from './components/ResetPassword'
import NotFound from './components/NotFound'

const PrivateRoute = ({ children }) => localStorage.getItem('token') ? children : <Navigate to="/login" />

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Auth />} />
      <Route path="/signup" element={<Auth initialTab="signup" />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/show/:slug" element={<ShowPage />} />
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
