import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Passport } from './pages/Passport'
import { Play } from './pages/Play'
import { db } from './lib/db'
import { summarise, today } from './lib/passport'
import { applyTheme, resolveTheme, storedTheme } from './lib/themes'
export default function App(){
 useEffect(()=>{void db.history.toArray().then(h=>applyTheme(resolveTheme(storedTheme(),summarise(h,today()).level),false))},[])
 return <Layout><Routes><Route path="/" element={<Home/>}/><Route path="/play/:id" element={<Play/>}/><Route path="/passport" element={<Passport/>}/></Routes></Layout>}
