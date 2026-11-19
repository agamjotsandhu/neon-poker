import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { lazy, Suspense } from 'react'
import { useGame } from './store/gameStore'
import { CityBackdrop } from './ui/components/CityBackdrop'
import { screenVariants } from './ui/motion'
import { LandingScreen } from './ui/screens/LandingScreen'

const GameScreen = lazy(() => import('./ui/screens/GameScreen').then((m) => ({ default: m.GameScreen })))
const HowToScreen = lazy(() => import('./ui/screens/HowToScreen').then((m) => ({ default: m.HowToScreen })))

export default function App() {
  const screen = useGame((s) => s.screen)
  return (
    <MotionConfig reducedMotion="user">
      <CityBackdrop dim={screen === 'game' ? 0.25 : 0} />
      <AnimatePresence mode="wait">
        <motion.div key={screen} variants={screenVariants} initial="hidden" animate="show" exit="exit" className="h-full">
          <Suspense fallback={null}>
            {screen === 'landing' && <LandingScreen />}
            {screen === 'howto' && <HowToScreen />}
            {screen === 'game' && <GameScreen />}
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  )
}
