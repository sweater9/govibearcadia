import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Passport } from './pages/Passport'
import { Play } from './pages/Play'
export default function App(){return <Layout><Routes><Route path="/" element={<Home/>}/><Route path="/play/:id" element={<Play/>}/><Route path="/passport" element={<Passport/>}/></Routes></Layout>}
