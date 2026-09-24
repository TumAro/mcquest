import { useNavigate } from 'react-router'
import { loadIndex, useJson } from '../data'
import ConfigScreen, { type TestConfig } from './ConfigScreen'

export default function Random() {
  const navigate = useNavigate()
  const { data: index } = useJson(() => loadIndex(), [])

  if (!index) {
    return <div style={{ padding: '1rem' }}>Loading...</div>
  }

  // Pre-select all topics for random mode
  const allTopicSlugs = new Set(
    Object.keys(index.topics).flatMap(categorySlug =>
      Object.keys(index.topics[categorySlug].topics)
    )
  )

  const handleStart = (config: TestConfig) => {
    navigate('/test/play', { state: { config } })
  }

  return (
    <ConfigScreen
      index={index}
      title="Random Test"
      showTopics={false}
      initialTopics={allTopicSlugs}
      onStart={handleStart}
    />
  )
}
