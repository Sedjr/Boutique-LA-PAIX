import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, Timestamp, getDocs } from 'firebase/firestore';
import { Order, CashMovement, Boutique } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Calculator, Send, CalendarDays, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

interface MyCashProps {
  userBoutique: Boutique;
  userUid: string;
}

export const MyCash: React.FC<MyCashProps> = ({ userBoutique, userUid }) => {
  const [dailyOrders, setDailyOrders] = useState<Order[]>([]);
  const [dailyMovements, setDailyMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGeneratingWeekly, setIsGeneratingWeekly] = useState(false);

  useEffect(() => {
    // Get start of today in local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    // Query orders for today in this boutique
    const ordersQuery = query(
      collection(db, 'orders'),
      where('boutiqueSource', '==', userBoutique),
      where('createdAt', '>=', todayTimestamp)
    );

    // Query movements for today in this boutique created by this user
    const movementsQuery = query(
      collection(db, 'cashMovements'),
      where('boutiqueSource', '==', userBoutique),
      where('dateHeure', '>=', todayTimestamp),
      where('createdBy', '==', userUid)
    );

    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      setDailyOrders(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'orders'));

    const unsubscribeMovements = onSnapshot(movementsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CashMovement[];
      setDailyMovements(data);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'cashMovements'));

    return () => {
      unsubscribeOrders();
      unsubscribeMovements();
    };
  }, [userBoutique, userUid]);

  // Calculations
  const totalEncaisse = dailyOrders.reduce((sum, order) => sum + (order.avancePayee || 0), 0);
  const totalDepenses = dailyMovements
    .filter(m => m.typeMouvement === 'Dépense Boutique' || m.typeMouvement === 'Prélèvement Patron')
    .reduce((sum, m) => sum + (m.montant || 0), 0);
  
  // Note: If there are 'Recette' movements manually added, we might want to include them in encaissé
  const manualRecettes = dailyMovements
    .filter(m => m.typeMouvement === 'Recette')
    .reduce((sum, m) => sum + (m.montant || 0), 0);

  const finalEncaisse = totalEncaisse + manualRecettes;
  const soldeTheorique = finalEncaisse - totalDepenses;

  const handleCloture = () => {
    const dateStr = new Date().toLocaleDateString('fr-FR');
    const message = `*CLÔTURE DE JOURNÉE - ${userBoutique}*\n` +
      `Date : ${dateStr}\n` +
      `--------------------------\n` +
      `💰 Total Encaissé : ${finalEncaisse.toLocaleString()} FCFA\n` +
      `💸 Total Dépenses : ${totalDepenses.toLocaleString()} FCFA\n` +
      `--------------------------\n` +
      `✅ *SOLDE FINAL : ${soldeTheorique.toLocaleString()} FCFA*\n` +
      `--------------------------\n` +
      `Rapport généré par la secrétaire.`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const handleWeeklyReport = async () => {
    const today = new Date();
    if (today.getDay() !== 6) { // 6 = Saturday
      toast.error("Cette action est uniquement disponible le samedi.");
      return;
    }
    
    setIsGeneratingWeekly(true);
    try {
      // Calculate start of week (last Monday)
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - 5);
      startOfWeek.setHours(0, 0, 0, 0);
      const startTimestamp = Timestamp.fromDate(startOfWeek);
      
      const ordersQuery = query(
        collection(db, 'orders'),
        where('boutiqueSource', '==', userBoutique),
        where('createdAt', '>=', startTimestamp)
      );

      const movementsQuery = query(
        collection(db, 'cashMovements'),
        where('boutiqueSource', '==', userBoutique),
        where('dateHeure', '>=', startTimestamp),
        where('createdBy', '==', userUid)
      );

      const [ordersSnap, movementsSnap] = await Promise.all([
        getDocs(ordersQuery),
        getDocs(movementsQuery)
      ]);

      const weeklyOrders = ordersSnap.docs.map(d => d.data() as Order);
      const weeklyMovements = movementsSnap.docs.map(d => d.data() as CashMovement);

      const wEncaisse = weeklyOrders.reduce((sum, order) => sum + (order.avancePayee || 0), 0);
      const wDepenses = weeklyMovements
        .filter(m => m.typeMouvement === 'Dépense Boutique' || m.typeMouvement === 'Prélèvement Patron')
        .reduce((sum, m) => sum + (m.montant || 0), 0);
      const wManualRecettes = weeklyMovements
        .filter(m => m.typeMouvement === 'Recette')
        .reduce((sum, m) => sum + (m.montant || 0), 0);

      const wFinalEncaisse = wEncaisse + wManualRecettes;
      const wSoldeTheorique = wFinalEncaisse - wDepenses;

      const dateStrStart = startOfWeek.toLocaleDateString('fr-FR');
      const dateStrEnd = today.toLocaleDateString('fr-FR');
      const message = `*BILAN HEBDOMADAIRE - ${userBoutique}*\n` +
        `Période : ${dateStrStart} au ${dateStrEnd}\n` +
        `--------------------------\n` +
        `💰 Total Encaissé : ${wFinalEncaisse.toLocaleString()} FCFA\n` +
        `💸 Total Dépenses : ${wDepenses.toLocaleString()} FCFA\n` +
        `--------------------------\n` +
        `✅ *SOLDE FINAL SEMAINE : ${wSoldeTheorique.toLocaleString()} FCFA*\n` +
        `--------------------------\n` +
        `Rapport généré par la secrétaire.`;

      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
      
    } catch(err) {
       toast.error("Erreur lors de la génération du bilan");
       console.error(err);
    } finally {
      setIsGeneratingWeekly(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Calcul du bilan en cours...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-black flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          Ma Caisse - {userBoutique}
        </h2>
        <p className="text-muted-foreground text-sm">Bilan de vos opérations aujourd'hui</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-2 border-green-100 bg-green-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-green-600 flex items-center gap-2">
                <ArrowDownCircle className="h-4 w-4" /> Total Encaissé
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-green-700">
                {finalEncaisse.toLocaleString()} <span className="text-lg">F</span>
              </div>
              <p className="text-[10px] text-green-600/70 mt-1 font-bold">Avances + Recettes manuelles</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-2 border-destructive/10 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-destructive flex items-center gap-2">
                <ArrowUpCircle className="h-4 w-4" /> Total Dépenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-destructive">
                {totalDepenses.toLocaleString()} <span className="text-lg">F</span>
              </div>
              <p className="text-[10px] text-destructive/70 mt-1 font-bold">Dépenses + Prélèvements</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-4 border-primary bg-primary/5 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <Calculator className="h-4 w-4" /> Solde Théorique
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black text-primary">
                {soldeTheorique.toLocaleString()} <span className="text-xl">F</span>
              </div>
              <p className="text-[10px] text-primary/70 mt-1 font-bold">Montant attendu en caisse</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="pt-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Button 
            onClick={handleCloture}
            className="w-full h-16 text-lg md:text-xl font-black gap-3 shadow-xl shadow-green-500/20 bg-green-600 hover:bg-green-700"
          >
            <Send className="h-6 w-6 shrink-0" />
            <span className="truncate">CLÔTURE JOURNÉE</span>
          </Button>
        </div>
        <div className="flex-1">
          <Button 
            onClick={handleWeeklyReport}
            disabled={isGeneratingWeekly}
            variant="outline"
            className="w-full h-16 text-lg md:text-xl font-black gap-3 shadow-xl shadow-blue-500/10 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
          >
            {isGeneratingWeekly ? <Loader2 className="h-6 w-6 animate-spin" /> : <CalendarDays className="h-6 w-6 shrink-0" />}
            <span className="truncate">BILAN HEBDO (Samedis)</span>
          </Button>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-4 italic">
        Le bilan journalier est à envoyer tous les jours, le bilan hebdomadaire uniquement les samedis.
      </p>
    </div>
  );
};
