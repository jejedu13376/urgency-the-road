import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useStartupGate } from '../context/StartupGateContext';
import { colors } from '../theme/colors';

/** Blocks all app content until password unlock (session only). */
export function StartupGateScreen() {
  const { unlock } = useStartupGate();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = () => {
    const ok = unlock(value);
    if (!ok) {
      setError('Mot de passe incorrect');
      setValue('');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>Urgence Mécanique</Text>
        <Text style={styles.title}>Accès sécurisé</Text>
        <Text style={styles.sub}>Entrez le mot de passe pour ouvrir l’application.</Text>
        <TextInput
          value={value}
          onChangeText={(t) => {
            setValue(t);
            setError(null);
          }}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Mot de passe"
          placeholderTextColor={colors.muted}
          style={styles.input}
          onSubmitEditing={onSubmit}
          testID="startup-gate-input"
          accessibilityLabel="Mot de passe de démarrage"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={styles.btn}
          onPress={onSubmit}
          testID="startup-gate-submit"
          accessibilityRole="button"
          accessibilityLabel="Déverrouiller"
        >
          <Text style={styles.btnTxt}>Déverrouiller</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.asphalt,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 22,
    gap: 12,
  },
  brand: {
    color: colors.signal,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  sub: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.mist,
  },
  error: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  btn: {
    backgroundColor: colors.signal,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnTxt: { color: colors.white, fontWeight: '800', fontSize: 15 },
});
