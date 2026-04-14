import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Shield, FileSpreadsheet, Clock, Download, Loader2, CheckCircle2 } from 'lucide-react';

export const Settings: React.FC = () => {
  const [timeLockEnabled, setTimeLockEnabled] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setTimeLockEnabled(docSnap.data().timeLockEnabled ?? true);
      }
      setLoading(false);
    }, (err) => {
      console.error("Settings listener error:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const toggleTimeLock = async (enabled: boolean) => {
    try {
      await updateDoc(doc(db, 'settings', 'global'), { timeLockEnabled: enabled });
      toast.success(enabled ? 'Contrôle d\'accès activé' : 'Contrôle d\'accès désactivé');
    } catch (err) {
      console.error("Error updating settings:", err);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const generateCSV = async () => {
    setIsExporting(true);
    try {
      const q = query(collection(db, 'orders'), where('exporte', '==', false));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        toast.info('Aucune nouvelle commande à exporter');
        setIsExporting(false);
        return;
      }

      const orders = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // CSV Headers
      let csvContent = "Date,Boutique,Agent,Numero Facture,Client,Montant Total,Avance,Reste\n";
      
      const batch = writeBatch(db);

      orders.forEach(order => {
        const row = [
          order.dateDepot,
          order.boutiqueSource,
          order.agent_saisie || 'Inconnu',
          order.numeroFacture,
          order.nomClient,
          order.montantTotal,
          order.avancePayee,
          order.resteAPayer
        ].join(',');
        csvContent += row + "\n";
        
        // Mark as exported
        batch.update(doc(db, 'orders', order.id), { exporte: true });
      });

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Rapport_LaPaix_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await batch.commit();
      toast.success(`${orders.length} commandes exportées avec succès`);
    } catch (err) {
      console.error("Export Error:", err);
      toast.error('Erreur lors de l\'exportation');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Chargement des paramètres...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        Paramètres Système
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Contrôle d'Accès
            </CardTitle>
            <CardDescription>
              Gérer les restrictions horaires pour le secrétariat.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
              <div className="space-y-0.5">
                <Label className="text-base font-bold">Activer les horaires (06h-22h30)</Label>
                <p className="text-xs text-muted-foreground">
                  Si désactivé, l'accès est libre 24h/24 (y compris Dimanche).
                </p>
              </div>
              <Switch 
                checked={timeLockEnabled} 
                onCheckedChange={toggleTimeLock} 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              Rapports & Exports
            </CardTitle>
            <CardDescription>
              Générer des fichiers CSV pour la comptabilité.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={generateCSV} 
              disabled={isExporting}
              className="w-full h-14 text-lg font-bold gap-2 bg-green-600 hover:bg-green-700"
            >
              {isExporting ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Download className="h-6 w-6" />
              )}
              Générer Rapport CSV
            </Button>
            <p className="text-[10px] text-center text-muted-foreground font-medium">
              Note: Seules les commandes non encore exportées seront incluses.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
