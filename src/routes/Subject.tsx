import { useNavigate } from 'react-router'
import { loadIndex, useJson } from '../data'
import ConfigScreen, { type TestConfig } from './ConfigScreen'

export default function Subject() {
  const navigate = useNavigate()
  const { data: index } = useJson(() => loadIndex(), [])

  if (!index) {
    return <div className="loading-state">Loading...</div>
  }

  const handleStart = (config: TestConfig) => {
    navigate('/test/play', { state: { config: { ...config, mode: 'subject-wise' } } })
  }

  return <ConfigScreen index={index} title="Subject-wise Test" showTopics={true} onStart={handleStart} />
}
