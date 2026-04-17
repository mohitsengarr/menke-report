'use client'

import { motion } from 'framer-motion'
import { type ReactNode } from 'react'

// ═══════════════════════════════════════════
// Animation Variants
// ═══════════════════════════════════════════

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

export const fadeInDown = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
}

export const fadeInLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
}

export const fadeInRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
}

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
}

export const slideInLeft = {
  initial: { x: -280, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -280, opacity: 0 },
}

// Stagger container for children
export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
}

export const staggerItem = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}

// ═══════════════════════════════════════════
// Wrapper Components
// ═══════════════════════════════════════════

interface AnimateProps {
  children: ReactNode
  className?: string
  delay?: number
}

/** Fade in from below -- great for page sections */
export function FadeInUp({ children, className, delay = 0 }: AnimateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Fade in with scale -- great for cards and modals */
export function ScaleIn({ children, className, delay = 0 }: AnimateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Stagger children -- great for lists and grids */
export function StaggerChildren({ children, className }: AnimateProps) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Individual stagger item -- wrap each child in StaggerChildren */
export function StaggerItem({ children, className }: Omit<AnimateProps, 'delay'>) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  )
}

/** Page wrapper -- fades in content on route change */
export function PageTransition({ children, className }: Omit<AnimateProps, 'delay'>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Hover scale effect -- great for interactive cards */
export function HoverCard({ children, className }: Omit<AnimateProps, 'delay'>) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Counter animation -- animates a number from 0 to target */
export function AnimatedCounter({ value, prefix = '', suffix = '', className }: {
  value: number
  prefix?: string
  suffix?: string
  className?: string
}) {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
      </motion.span>
    </motion.span>
  )
}

/** Table row animation -- slides in from left */
export function AnimatedTableRow({ children, index = 0, className }: {
  children: ReactNode
  index?: number
  className?: string
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.tr>
  )
}

// Re-export motion for direct use
export { motion }
