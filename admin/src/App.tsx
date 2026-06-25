import React from 'react'

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AdminRoute } from './components/AdminRoute'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'

const App = (): React.JSX.Element => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <AdminRoute>
              <DashboardPage />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
