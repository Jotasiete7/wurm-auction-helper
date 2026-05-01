import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

import { LayoutBase } from '@ecossistema-guilda/layout/LayoutBase'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LayoutBase>
      <App />
    </LayoutBase>
  </React.StrictMode>,
)
