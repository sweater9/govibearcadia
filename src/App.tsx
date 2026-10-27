import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Play } from './pages/Play'
export default function App(){return <Layout><Routes><Route path="/" element={<Home/>}/><Route path="/play/:id" element={<Play/>}/></Routes></Layout>}
