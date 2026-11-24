import { ReactNode, useEffect } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const SPRING = { damping: 16, stiffness: 220, mass: 0.7 };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Soft entrance — use for section heroes / key panels (not every tiny row). */
export function FadeInBlock({
  children,
  style,
  delayMs = 0,
  from = 'up',
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  delayMs?: number;
  from?: 'up' | 'down';
  accessibilityLabel?: string;
}) {
  const entering =
    from === 'down'
      ? FadeInDown.delay(delayMs).duration(420).easing(Easing.out(Easing.cubic))
      : FadeInUp.delay(delayMs).duration(420).easing(Easing.out(Easing.cubic));
  return (
    <Animated.View entering={entering} style={style} accessibilityLabel={accessibilityLabel}>
      {children}
    </Animated.View>
  );
}

/** Press scale for primary CTAs and catalog tiles — intentional, not noisy. */
export function PressScale({
  children,
  style,
  pressedScale = 0.97,
  ...rest
}: PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style, animStyle]}
      onPressIn={(e) => {
        // Reanimated shared value write (not React state).
        // eslint-disable-next-line react-hooks/immutability -- shared value API
        scale.value = withSpring(pressedScale, SPRING);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        // eslint-disable-next-line react-hooks/immutability -- shared value API
        scale.value = withSpring(1, SPRING);
        rest.onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Animated progress fill (0–100). Keeps dyslexia-friendly solid color bar. */
export function AnimatedBarFill({
  pct,
  color,
  style,
}: {
  pct: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}) {
  const width = useSharedValue(Math.max(4, Math.min(100, pct)));
  useEffect(() => {
    width.value = withTiming(Math.max(4, Math.min(100, pct)), {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, width]);
  const animStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
    backgroundColor: color,
  }));
  return <Animated.View style={[style, animStyle]} />;
}
