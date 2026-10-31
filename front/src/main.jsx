import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { api } from './api.js'
import { fijarTasa } from './formato.js'
import DashboardRoot from './dashboard/DashboardRoot.jsx'
import AppRoot from './app/AppRoot.jsx'
import './base.css'

function Inicio() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F3F4F8' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <h1 style={{ margin: 0, color: '#15152B' }}>Credirecto</h1>
        <Link to="/dashboard">Dashboard de Credirecto</Link>
        <Link to="/app">App móvil (pruebas)</Link>
      </div>
    </div>
  )
}

function Raiz() {
  useEffect(() => { api.salud().then((s) => fijarTasa(s.tasa_bs)).catch(() => {}) }, [])
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/dashboard/*" element={<DashboardRoot />} />
      <Route path="/app/*" element={<AppRoot />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Raiz />
    </BrowserRouter>
  </React.StrictMode>,
)
