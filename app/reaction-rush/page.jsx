// app/reaction-rush/page.jsx
'use client'
import dynamic from 'next/dynamic'
const ReactionRush = dynamic(() => import('../../components/ReactionRush'), { ssr: false })
export default function Page(){ return <ReactionRush/> }
