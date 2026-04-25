import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, where, limit, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { CashMovement, Boutique, TypeMouvement } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Wallet, ArrowUpCircle, ArrowDownCircle, History, Store, X, Trash2 } from 'lucide-react';

interface CashManagementProps {
  userBoutique: Boutique;
  isAdmin: boolean;
  agentName: string;
  timeLockEnabled: boolean;
}

export const CashManagement: React.FC<CashManagementProps> = ({ userBoutique, isAdmin, agentName, timeLockEnabled }) => {
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<boolean>(false);

  const [formData, setFormData] = useState<Partial<CashMovement>>({
    typeMouvement: 'Dépense Boutique',
    montant: 0,
    description: '',
    boutiqueSource: userBoutique === 'Toutes' ? 'Senade' : userBoutique as any,
    agent_saisie: agentName,
  });

  const [queryLimit, setQueryLimit] = useState(20);

  useEffect(() => {
    if (!userBoutique) return;

    let q = query(collection(db, 'cashMovements'), orderBy('dateHeure', 'desc'), limit(queryLimit));
    
    if (userBoutique !== 'Toutes') {
      q = query(collection(db, 'cashMovements'), 
        where('boutiqueSource', '==', userBoutique),
        orderBy('dateHeure', 'desc'),
        limit(queryLimit)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CashMovement[];
      setMovements(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cashMovements');
    });

    return () => unsubscribe();
  }, [userBoutique, queryLimit]);

  const isWithinServiceHours = () => {
    if (!timeLockEnabled) return true;
    const now = new Date();
    const day = now.getDay();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const time = hours * 60 + minutes;
    
    if (day === 0) return false;
    
    const start = 6 * 60; // 06:00
    const end = 22 * 60 + 30; // 22:30
    return time >= start && time <= end;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!auth.currentUser) return;
    setSubmitError(false);

    if (!isAdmin && !isWithinServiceHours()) {
      toast.error("La boutique est fermée. Revenez demain à 06h00.");
      return;
    }

    setIsSubmitting(true);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), 5000)
    );

    try {
      const today = new Date();
      const getWeekNumber = (d: Date) => {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
        const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
        return date.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
      };

      const dateStr = today.toISOString().split('T')[0];

      const dbOperation = addDoc(collection(db, 'cashMovements'), {
        ...formData,
        agent_saisie: agentName,
        dateHeure: serverTimestamp(),
        createdBy: auth.currentUser.uid,
        mois: dateStr.substring(0, 7), // YYYY-MM
        semaine: getWeekNumber(today) // YYYY-Wxx
      });

      await Promise.race([dbOperation, timeoutPromise]);

      toast.success('Mouvement enregistré');
      setShowForm(false);
      setFormData({
        typeMouvement: 'Dépense Boutique',
        montant: 0,
        description: '',
        boutiqueSource: userBoutique === 'Toutes' ? 'Senade' : userBoutique as any,
        agent_saisie: agentName,
      });
    } catch (err: any) {
      setSubmitError(true);
      if (err.message === 'TIMEOUT') {
        toast.error("Erreur réseau, réessayez dans un instant");
      } else {
        handleFirestoreError(err, OperationType.WRITE, 'cashMovements');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeBadge = (type: TypeMouvement) => {
    switch (type) {
      case 'Recette': return <Badge className="bg-green-100 text-green-700 border-green-200">Recette</Badge>;
      case 'Dépense Boutique': return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Dépense</Badge>;
      case 'Prélèvement Patron': return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Prélèvement</Badge>;
    }
  };

  const handleDeleteAll = async () => {
    if (!isAdmin) return;
    if (!window.confirm("🔴 ATTENTION: Voulez-vous vraiment supprimer TOUT l'historique de caisse ? Cette action est irréversible.")) return;
    
    try {
      const allSnapshot = await getDocs(collection(db, 'cashMovements'));
      const count = allSnapshot.docs.length;
      await Promise.all(allSnapshot.docs.map(d => deleteDoc(d.ref)));
      toast.success(`Historique vidé (${count} éléments supprimés)`);
    } catch(err) {
      toast.error("Erreur lors de la suppression de l'historique");
      console.error(err);
    }
  };

  const handleDeleteMovement = async (id: string, description: string) => {
    if (!isAdmin) return;
    if (!window.confirm(`Voulez-vous supprimer ce mouvement ?\n(${description})`)) return;
    
    try {
      await deleteDoc(doc(db, 'cashMovements', id));
      toast.success("Mouvement supprimé");
    } catch(err) {
      toast.error("Erreur lors de la suppression");
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          Gestion de Caisse
        </h2>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouveau Mouvement
        </Button>
      </div>

      {showForm && (
        <Card className="border-2 shadow-lg relative">
          <CardHeader className="bg-muted/30 flex flex-row items-center justify-between">
            <CardTitle>Enregistrer un flux</CardTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowForm(false)}
              className="h-10 w-10 rounded-full hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20 transition-colors"
            >
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type de Mouvement</Label>
                <Select 
                  value={formData.typeMouvement} 
                  onValueChange={(val: any) => setFormData({ ...formData, typeMouvement: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Recette">Recette (Vente)</SelectItem>
                    <SelectItem value="Dépense Boutique">Dépense Boutique</SelectItem>
                    <SelectItem value="Prélèvement Patron">Prélèvement Patron</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.typeMouvement === 'Dépense Boutique' && (
                <div className="space-y-2">
                  <Label>Catégorie de Dépense</Label>
                  <Select 
                    value={formData.description.split(' - ')[0]} 
                    onValueChange={(val: string) => setFormData({ ...formData, description: `${val} - ` })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fournitures">Fournitures (Savon, etc.)</SelectItem>
                      <SelectItem value="Loyer">Loyer / Factures</SelectItem>
                      <SelectItem value="Maintenance">Maintenance / Réparation</SelectItem>
                      <SelectItem value="Autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Montant (FCFA)</Label>
                <Input 
                  type="number" 
                  value={formData.montant} 
                  onChange={e => setFormData({ ...formData, montant: Number(e.target.value) })}
                  required
                />
              </div>

              {isAdmin && (
                <div className="space-y-2">
                  <Label>Boutique</Label>
                  <Select 
                    value={formData.boutiqueSource} 
                    onValueChange={(val: any) => setFormData({ ...formData, boutiqueSource: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Senade">Senade</SelectItem>
                      <SelectItem value="Gankpodo">Gankpodo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Input 
                  placeholder="Ex: Achat savon, Réparation fer..." 
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="md:col-span-2 flex flex-col gap-2 pt-2">
                {submitError && (
                  <div className="p-4 bg-destructive/10 border border-destructive rounded-lg flex items-center justify-between mb-2">
                    <span className="text-destructive font-bold">Erreur réseau détectée</span>
                    <Button type="button" variant="destructive" size="sm" onClick={() => handleSubmit()}>
                      Réessayer
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-2">
        <CardHeader className="bg-muted/30 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historique des flux
          </CardTitle>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="font-mono">
              {movements.length} opérations
            </Badge>
            {isAdmin && movements.length > 0 && (
              <Button variant="destructive" size="sm" onClick={handleDeleteAll} className="gap-2">
                <Trash2 className="h-4 w-4" />
                Tout supprimer
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Boutique</TableHead>
                <TableHead>Description</TableHead>
                {isAdmin && <TableHead>Agent</TableHead>}
                <TableHead className="text-right">Montant</TableHead>
                {isAdmin && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.dateHeure?.toDate().toLocaleString()}
                  </TableCell>
                  <TableCell>{getTypeBadge(m.typeMouvement)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs font-bold">
                      <Store className="h-3 w-3" />
                      {m.boutiqueSource}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{m.description}</TableCell>
                  {isAdmin && (
                    <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">
                      {m.agent_saisie || 'Inconnu'}
                    </TableCell>
                  )}
                  <TableCell className={`text-right font-bold ${m.typeMouvement === 'Recette' ? 'text-green-600' : 'text-destructive'}`}>
                    {m.typeMouvement === 'Recette' ? '+' : '-'} {m.montant.toLocaleString()} F
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteMovement(m.id!, m.description)} className="text-destructive hover:bg-destructive hover:text-white h-8 w-8">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {movements.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 5} className="h-24 text-center text-muted-foreground">
                    Aucun mouvement enregistré.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {movements.length === queryLimit && (
        <div className="flex justify-center mt-6">
          <Button variant="outline" onClick={() => setQueryLimit(prev => prev + 20)} className="rounded-full shadow-sm font-medium px-8">
            Charger plus
          </Button>
        </div>
      )}
    </div>
  );
};
