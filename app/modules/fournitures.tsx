import { Link, Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { StubBanner } from '../../src/components/StubBanner';
import { MOCK_MAINTENANCE, MOCK_PARTS, MOCK_PLACES } from '../../src/data/mocks';
import { colors } from '../../src/theme/colors';

/**
 * Hub « Je fournis / L’app fournit » — documents, pièces, services.
 * Branche les mocks partage (M16) · pièces (M3) · pro (M17). Hors parcours XP.
 */
export default function FournituresHub() {
  const docsUser = MOCK_MAINTENANCE.filter((m) => m.title.toLowerCase().includes('assurance') || m.title.toLowerCase().includes('contrôle'));
  const pieceSample = MOCK_PARTS.slice(0, 2);
  const serviceSample = MOCK_PLACES.filter((p) => p.kind === 'garage' || p.kind === 'pieces').slice(0, 2);

  return (
    <>
      <Stack.Screen options={{ title: 'Je fournis / L’app fournit' }} />
      <Screen
        title="Je fournis / L’app fournit"
        subtitle="Documents · pièces · services — qui apporte quoi"
      >
        <StubBanner text="MOCK — aperçu fournitures depuis mocks locaux (partage / pièces / pro)" />

        <Card title="Vous fournissez">
          <Text style={styles.meta}>
            Documents admin, pièces achetées, partage de lien — actions côté conducteur.
          </Text>
          {docsUser.length > 0 ? (
            <View style={styles.list}>
              {docsUser.map((d) => (
                <Text key={d.id} style={styles.bullet}>
                  · {d.title}
                  {d.dueDateIso ? ` · échéance ${d.dueDateIso}` : ''}
                </Text>
              ))}
            </View>
          ) : null}
          <Link href="/modules/partage" asChild>
            <Pressable style={styles.item}>
              <Text style={styles.id}>M16</Text>
              <View style={styles.body}>
                <Text style={styles.title}>Documents & partage viral</Text>
                <Text style={styles.sub}>SMS / WhatsApp / mail · lien d’install</Text>
              </View>
            </Pressable>
          </Link>
          <Link href="/modules/pieces" asChild>
            <Pressable style={styles.item}>
              <Text style={styles.id}>M3</Text>
              <View style={styles.body}>
                <Text style={styles.title}>Vos pièces & devis</Text>
                <Text style={styles.sub}>Coller un devis · comparer · panier</Text>
              </View>
            </Pressable>
          </Link>
        </Card>

        <Card title="L’app fournit">
          <Text style={styles.meta}>
            Catalogue pièces mock, magasin / atelier à proximité, créneaux pro.
          </Text>
          {pieceSample.map((p) => (
            <Text key={p.id} style={styles.bullet}>
              · {p.name} — dès {Math.round(p.priceAftermarket)} {p.currency}
            </Text>
          ))}
          {serviceSample.map((s) => (
            <Text key={s.id} style={styles.bullet}>
              · {s.name} ({s.kind}) · {s.distanceKm} km
            </Text>
          ))}
          <Link href="/modules/pieces" asChild>
            <Pressable style={styles.item}>
              <Text style={styles.id}>M3</Text>
              <View style={styles.body}>
                <Text style={styles.title}>Catalogue pièces & anti-arnaque</Text>
                <Text style={styles.sub}>Prix marché · estimation pose</Text>
              </View>
            </Pressable>
          </Link>
          <Link href="/modules/pro" asChild>
            <Pressable style={styles.item}>
              <Text style={styles.id}>M17</Text>
              <View style={styles.body}>
                <Text style={styles.title}>Services atelier / pro</Text>
                <Text style={styles.sub}>RDV · KPI · avis — mock + Auth si dispo</Text>
              </View>
            </Pressable>
          </Link>
          <Link href="/modules/garages" asChild>
            <Pressable style={styles.linkRow}>
              <Text style={styles.linkTxt}>Garages & magasins GPS (M9) →</Text>
            </Pressable>
          </Link>
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.muted, fontSize: 12 },
  list: { gap: 4, marginTop: 4 },
  bullet: { color: colors.slate, fontSize: 12, fontWeight: '600' },
  item: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    alignItems: 'flex-start',
  },
  id: {
    backgroundColor: colors.asphalt,
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  body: { flex: 1, gap: 2 },
  title: { fontWeight: '700', color: colors.ink },
  sub: { color: colors.muted, fontSize: 12 },
  linkRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  linkTxt: { color: colors.signal, fontWeight: '800', fontSize: 13 },
});
