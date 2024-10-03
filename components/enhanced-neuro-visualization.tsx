'use client'

import React, { useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text, Html, useTexture } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import * as Tone from 'tone'
import * as faceapi from 'face-api.js'

interface BrainSignals {
  focus: number;
  cognitiveLoad: number;
  stress: number;
  attention: number;
  emotion: string;
  mentalFatigue: number;
}

const getPersonCondition = (signals: BrainSignals): string => {
  if (signals.stress > 80) return "🔴 Highly Stressed!"
  if (signals.stress > 60) return "😓 Moderately Stressed"
  if (signals.focus > 80 && signals.attention > 80) return "🎯 In the Zone"
  if (signals.focus > 80) return "🧠 Deeply Focused"
  if (signals.focus < 20) return "😶‍🌫️ Unfocused"
  if (signals.attention < 20) return "🦋 Distracted"
  if (signals.cognitiveLoad > 80) return "🤯 Mentally Overloaded"
  if (signals.cognitiveLoad < 20 && signals.attention > 80) return "😌 Relaxed and Alert"
  if (signals.focus > 60 && signals.cognitiveLoad > 60) return "🤔 Concentrating Hard"
  if (signals.attention > 80 && signals.stress < 30) return "😊 Calmly Attentive"
  return "😐 Neutral State"
}

const getEmotionColor = (emotion: string): THREE.Color => {
  switch (emotion) {
    case 'happy':
      return new THREE.Color(1, 1, 0) // Yellow
    case 'sad':
      return new THREE.Color(0, 0, 1) // Blue
    case 'angry':
      return new THREE.Color(1, 0, 0) // Red
    case 'fearful':
      return new THREE.Color(0.5, 0, 0.5) // Purple
    case 'disgusted':
      return new THREE.Color(0, 0.5, 0) // Green
    case 'surprised':
      return new THREE.Color(1, 0.5, 0) // Orange
    default:
      return new THREE.Color(0.5, 0.5, 0.5) // Gray for neutral
  }
}

interface BrainSignalProps {
  signals: BrainSignals;
}

const BrainSignal: React.FC<BrainSignalProps> = ({ signals }) => {
  const mesh = useRef<THREE.Mesh>(null)
  const textRef = useRef<any>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const particlesRef = useRef<THREE.Mesh[]>([])
  const emotionRef = useRef<THREE.Mesh>(null)
  const { scene } = useThree()
  const targetPosition = useRef(new THREE.Vector3(0, 0, 0))
  const targetColor = useRef(new THREE.Color(0.5, 0.5, 0.5))
  const currentColor = useRef(new THREE.Color(0.5, 0.5, 0.5))

  const textures = useTexture({
    happy: '/placeholder.svg?height=64&width=64',
    sad: '/placeholder.svg?height=64&width=64',
    neutral: '/placeholder.svg?height=64&width=64',
  })

  const synth = useMemo(() => new Tone.Synth().toDestination(), [])
  const noise = useMemo(() => new Tone.Noise('pink').toDestination(), [])
  const filter = useMemo(() => new Tone.Filter(1000, 'lowpass').toDestination(), [])

  useEffect(() => {
    noise.connect(filter)
    return () => {
      noise.disconnect()
    }
  }, [noise, filter])

  useFrame((state, delta) => {
    if (mesh.current) {
      mesh.current.position.lerp(targetPosition.current, 0.1)
      targetPosition.current.set(
        (signals.focus - 50) * 0.04,
        (signals.stress - 50) * 0.04,
        0
      )
      targetPosition.current.clamp(new THREE.Vector3(-2, -2, -2), new THREE.Vector3(2, 2, 2))

      currentColor.current.lerp(targetColor.current, 0.1)
      mesh.current.material.color = currentColor.current

      const emotionColor = getEmotionColor(signals.emotion)
      const stressColor = new THREE.Color(1, 0, 0)
      targetColor.current.lerpColors(emotionColor, stressColor, signals.stress / 100)

      const scale = 0.5 + signals.attention * 0.01
      mesh.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1)

      const rotationSpeed = signals.cognitiveLoad * 0.0002
      mesh.current.rotation.x += rotationSpeed
      mesh.current.rotation.y += rotationSpeed

      if (glowRef.current) {
        glowRef.current.material.color = currentColor.current
        ;(glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + (signals.stress / 100) * 0.7
        glowRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2) * 0.1)
      }

      if (signals.stress > 60) {
        emitParticles(mesh.current.position, scene, particlesRef, signals.stress)
      }
      updateParticles(particlesRef, delta, signals.stress)

      if (emotionRef.current) {
        if (signals.emotion === 'happy') (emotionRef.current.material as THREE.MeshBasicMaterial).map = textures.happy
        else if (signals.emotion === 'sad') (emotionRef.current.material as THREE.MeshBasicMaterial).map = textures.sad
        else (emotionRef.current.material as THREE.MeshBasicMaterial).map = textures.neutral

        emotionRef.current.position.y = 1.5 + Math.sin(state.clock.elapsedTime * 2) * 0.1
      }

      // Play sound based on focus and stress
      if (signals.focus > 80) {
        synth.triggerAttackRelease("C4", "8n")
        filter.frequency.rampTo(2000, 0.1)
      } else if (signals.focus < 20) {
        synth.triggerAttackRelease("A3", "8n")
        filter.frequency.rampTo(500, 0.1)
      }

      if (signals.stress > 80) {
        noise.volume.rampTo(-20, 0.1)
        noise.start()
      } else {
        noise.stop()
      }
    }

    if (textRef.current) {
      textRef.current.position.x = mesh.current?.position.x || 0
      textRef.current.position.y = (mesh.current?.position.y || 0) + 1.5
      textRef.current.position.z = mesh.current?.position.z || 0
      textRef.current.text = getPersonCondition(signals)
    }
  })

  return (
    <group>
      <mesh ref={mesh}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshBasicMaterial transparent opacity={0.3} />
      </mesh>
      <Text
        ref={textRef}
        color="white"
        anchorX="center"
        anchorY="middle"
        fontSize={0.2}
      >
        {getPersonCondition(signals)}
      </Text>
      <mesh ref={emotionRef} position={[0, 1.5, 0]}>
        <planeGeometry args={[0.5, 0.5]} />
        <meshBasicMaterial map={textures.neutral} transparent />
      </mesh>
      <Html>
        <div className="bg-white bg-opacity-50 p-2 rounded">
          <div>Attention: {signals.attention}%</div>
          <div>Stress: {signals.stress}%</div>
          <div>Focus: {signals.focus}%</div>
          <div>Cognitive Load: {signals.cognitiveLoad}%</div>
          <div>Emotion: {signals.emotion}</div>
          <div>Mental Fatigue: {signals.mentalFatigue}%</div>
        </div>
      </Html>
    </group>
  )
}

const emitParticles = (position: THREE.Vector3, scene: THREE.Scene, particlesRef: React.MutableRefObject<THREE.Mesh[]>, stress: number) => {
  const particleCount = Math.floor(stress / 20)
  for (let i = 0; i < particleCount; i++) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.5, 0) })
    )
    particle.position.set(
      position.x + (Math.random() - 0.5) * 0.5,
      position.y + (Math.random() - 0.5) * 0.5,
      position.z + (Math.random() - 0.5) * 0.5
    )
    ;(particle as any).velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.05,
      (Math.random() - 0.5) * 0.05,
      (Math.random() - 0.5) * 0.05
    )
    scene.add(particle)
    particlesRef.current.push(particle)
  }
}

const updateParticles = (particlesRef: React.MutableRefObject<THREE.Mesh[]>, delta: number, stress: number) => {
  particlesRef.current.forEach((particle, index) => {
    particle.position.add((particle as any).velocity)
    ;(particle.material as THREE.MeshBasicMaterial).opacity -= delta * (stress / 100)
    if ((particle.material as THREE.MeshBasicMaterial).opacity <= 0) {
      particlesRef.current.splice(index, 1)
      particle.removeFromParent()
    }
  })
}

interface ControlPanelProps {
  signals: BrainSignals;
  setSignals: React.Dispatch<React.SetStateAction<BrainSignals>>;
  isAutoMode: boolean;
  setIsAutoMode: React.Dispatch<React.SetStateAction<boolean>>;
  takeBreak: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ signals, setSignals, isAutoMode, setIsAutoMode, takeBreak }) => {
  return (
    <motion.div 
      className="w-full md:w-1/3 p-4 bg-white rounded-lg shadow-lg"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-xl font-semibold mb-4">Neural Control Panel</h2>
      
      {Object.entries(signals).map(([signalType, value]) => (
        <div key={signalType} className="mb-4">
          <label className="block text-sm font-medium text-gray-700 capitalize">{signalType}</label>
          {signalType === 'emotion' ? (
            <select
              value={value as string}
              onChange={(e) => setSignals(prev => ({ ...prev, [signalType]: e.target.value }))}
              disabled={isAutoMode}
              className="w-full p-2 border rounded"
            >
              <option value="neutral">Neutral</option>
              <option value="happy">Happy</option>
              <option value="sad">Sad</option>
              <option value="angry">Angry</option>
              <option value="fearful">Fearful</option>
              <option value="disgusted">Disgusted</option>
              <option value="surprised">Surprised</option>
            </select>
          ) : (
            <>
              <input
                type="range"
                min="0"
                max="100"
                value={value as number}
                onChange={(e) => setSignals(prev => ({ ...prev, [signalType]: parseInt(e.target.value, 10) }))}
                disabled={isAutoMode}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm text-gray-500">Value: {value}</span>
            </>
          )}
        </div>
      ))}

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsAutoMode(!isAutoMode)}
        className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-300 mb-4"
      >
        {isAutoMode ? 'Switch to Manual Control' : 'Switch to Auto Simulation'}
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={takeBreak}
        className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition duration-300"
      >
        Take a Break
      </motion.button>

      <div className="mt-4">
        <h3 className="font-semibold">Neuro-Visualization Guide:</h3>
        <ul className="list-disc list-inside text-sm">
          <li>Sphere size reflects attention level (larger = more attentive)</li>
          <li>Color intensity shows stress (blue = calm, red = stressed)</li>
          <li>Horizontal position represents focus (right = high focus)</li>
          <li>Vertical position represents stress (higher = more stressed)</li>
          <li>Rotation speed indicates cognitive load</li>
          <li>Particle emission occurs during high stress</li>
          <li>Text and emoji above sphere describes the current mental state</li>
          <li>Glow intensity increases with stress level</li>
          <li>Emotion is represented by the floating icon and sphere color</li>
          <li>Audio cues play for different mental states</li>
        </ul>
      </div>
    </motion.div>
  )
}

interface WebcamEmotionDetectorProps {
  onEmotionDetected: (emotion: string) => void;
}

const WebcamEmotionDetector: React.FC<WebcamEmotionDetectorProps> = ({ onEmotionDetected }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models'
      
      try {
        await faceapi.loadTinyFaceDetectorModel(MODEL_URL)
        await faceapi.loadFaceLandmarkModel(MODEL_URL)
        await faceapi.loadFaceRecognitionModel(MODEL_URL)
        await faceapi.loadFaceExpressionModel(MODEL_URL)
        setModelsLoaded(true)
      } catch (error) {
        console.error("Error loading models:", error)
      }
    }

    loadModels()
  }, [])

  useEffect(() => {
    if (modelsLoaded) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
        })
        .catch((err) => console.error("Error accessing webcam:", err))
    }
  }, [modelsLoaded])

  const handleVideo = () => {
    if (!modelsLoaded || !videoRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const displaySize = { width: videoRef.current.width, height: videoRef.current.height }
    faceapi.matchDimensions(canvas, displaySize)

    setInterval(async () => {
      if (videoRef.current) {
        const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions()

        const resizedDetections = faceapi.resizeResults(detections, displaySize)
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
        faceapi.draw.drawDetections(canvas, resizedDetections)
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections)

        if (detections.length > 0) {
          const emotions = detections[0].expressions
          const dominantEmotion = Object.entries(emotions).reduce((a, b) => a[1] > b[1] ? a : b)[0]
          onEmotionDetected(dominantEmotion)
        }
      }
    }, 100)
  }

  return (
    <div className="relative">
      {!modelsLoaded && <div className="absolute inset-0 flex items-center justify-center bg-gray-200">Loading models...</div>}
      <video
        ref={videoRef}
        autoPlay
        muted
        onPlay={handleVideo}
        width={720}
        height={560}
        style={{ display: modelsLoaded ? 'block' : 'none' }}
      />
      <canvas ref={canvasRef} className="absolute top-0 left-0" width={720} height={560} />
    </div>
  )
}

export default function EnhancedNeuroVisualization() {
  const [brainSignals, setBrainSignals] = useState<BrainSignals>({
    focus: 50,
    cognitiveLoad: 50,
    stress: 50,
    attention: 50,
    emotion: 'neutral',
    mentalFatigue: 50
  })
  const [isAutoMode, setIsAutoMode] = useState(true)
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipContent, setTooltipContent] = useState('')

  useEffect(() => {
    let intervalId: NodeJS.Timeout

    if (isAutoMode) {
      intervalId = setInterval(() => {
        setBrainSignals(prevSignals => ({
          focus: Math.max(0, Math.min(100, prevSignals.focus + (Math.random() - 0.5) * 20)),
          cognitiveLoad: Math.max(0, Math.min(100, prevSignals.cognitiveLoad + (Math.random() - 0.5) * 20)),
          stress: Math.max(0, Math.min(100, prevSignals.stress + (Math.random() - 0.5) * 20)),
          attention: Math.max(0, Math.min(100, prevSignals.attention + (Math.random() - 0.5) * 20)),
          emotion: prevSignals.emotion,
          mentalFatigue: Math.max(0, Math.min(100, prevSignals.mentalFatigue + (Math.random() - 0.5) * 10))
        }))
      }, 1000)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [isAutoMode])

  const handleCanvasHover = (event: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY } = event
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect()
    const x = (clientX - left) / width * 2 - 1
    const y = -(clientY - top) / height * 2 + 1

    if (x > 0.8) {
      setTooltipContent('High Focus')
      setShowTooltip(true)
    } else if (x < -0.8) {
      setTooltipContent('Low Focus')
      setShowTooltip(true)
    } else if (y > 0.8) {
      setTooltipContent('High Stress')
      setShowTooltip(true)
    } else if (y < -0.8) {
      setTooltipContent('Low Stress')
      setShowTooltip(true)
    } else {
      setShowTooltip(false)
    }
  }

  const takeBreak = () => {
    setBrainSignals(prev => ({
      ...prev,
      stress: Math.max(0, prev.stress - 20),
      mentalFatigue: Math.max(0, prev.mentalFatigue - 20)
    }))
  }

  const handleEmotionDetected = (emotion: string) => {
    setBrainSignals(prev => ({ ...prev, emotion }))
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-100 to-purple-100">
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-2xl font-bold">Enhanced Neuro-Visualization</h1>
        <div className="text-lg mt-2">
          Current Condition: {getPersonCondition(brainSignals)}
        </div>
      </header>

      <main className="flex-grow flex flex-col md:flex-row p-4">
        <div className="w-full md:w-2/3 flex flex-col">
          <div 
            className="h-[400px] md:h-[500px] relative"
            onMouseMove={handleCanvasHover}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <Canvas camera={{ position: [0, 0, 5] }}>
              <ambientLight intensity={0.5} />
              <pointLight position={[10, 10, 10]} />
              <BrainSignal signals={brainSignals} />
              <OrbitControls />
            </Canvas>
            <AnimatePresence>
              {showTooltip && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-2 left-2 bg-white bg-opacity-75 p-2 rounded"
                >
                  {tooltipContent}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="mt-4">
            <h2 className="text-xl font-semibold mb-2">Webcam Emotion Detection</h2>
            <WebcamEmotionDetector onEmotionDetected={handleEmotionDetected} />
          </div>
        </div>

        <ControlPanel 
          signals={brainSignals}
          setSignals={setBrainSignals}
          isAutoMode={isAutoMode}
          setIsAutoMode={setIsAutoMode}
          takeBreak={takeBreak}
        />
      </main>
    </div>
  )
}