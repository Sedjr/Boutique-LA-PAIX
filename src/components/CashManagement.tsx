import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, where } from 'firebase/firestore';
import { CashMovement, Boutique, TypeMouvement } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Wallet, ArrowUpCircle, ArrowDownCircle, History, Store, X } from 'lucide-react';

interface CashManagementProps {
  userBoutique: Boutique;
  isAdmin: boolean;
}

export const CashManagement: React.FC<CashManagementProps> = ({ userBoutique, isAdmin }) => {
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<Partial<CashMovement>>({
    typeMouvement: 'Dépense Boutique',
    montant: 0,
    description: '',
    boutiqueSource: userBoutique === 'Toutes' ? 'Senade' : userBoutique as any,
  });

  useEffect(() => {
    if (!userBoutique) return;

    let q = query(collection(db, 'cashMovements'), orderBy('dateHeure', 'desc'));
    
    if (userBoutique !== 'Toutes') {
      q = query(collection(db, 'cashMovements'), 
        where('boutiqueSource', '==', userBoutique),
        orderBy('dateHeure', 'desc')
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
  }, [userBoutique]);

  const isWithinServiceHours = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const time = hours * 60 + minutes;
    const start = 6 * 60; // 06:00
    const end = 22 * 60 + 30; // 22:30
    return time >= start && time <= end;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    if (!isAdmin && !isWithinServiceHours()) {
      toast.error("Action refusée : En dehors des heures de service (06:00 - 22:30)");
      return;
    }

    try {
      await addDoc(collection(db, 'cashMovements'), {
        ...formData,
        dateHeure: serverTimestamp(),
        createdBy: auth.currentUser.uid,
      });
      toast.success('Mouvement enregistré');
      setShowForm(false);
      setFormData({
        typeMouvement: 'Dépense Boutique',
        montant: 0,
        description: '',
        boutiqueSource: userBoutique === 'Toutes' ? 'Senade' : userBoutique as any,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'cashMovements');
    }
  };

  const getTypeBadge = (type: TypeMouvement) => {
    switch (type) {
      case 'Recette': return <Badge className="bg-green-100 text-green-700 border-green-200">Recette</Badge>;
      case 'Dépense Boutique': return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Dépense</Badge>;
      case 'Prélèvement Patron': return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Prélèvement</Badge>;
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

              <div className="md:col-span-2 flex gap-2 pt-2">
                <Button type="submit" className="flex-1">Enregistrer</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
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
          <Badge variant="outline" className="font-mono">
            {movements.length} opérations
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Boutique</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Montant</TableHead>
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
                  <TableCell className={`text-right font-bold ${m.typeMouvement === 'Recette' ? 'text-green-600' : 'text-destructive'}`}>
                    {m.typeMouvement === 'Recette' ? '+' : '-'} {m.montant.toLocaleString()} F
                  </TableCell>
                </TableRow>
              ))}
              {movements.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Aucun mouvement enregistré.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
