import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Order, TypeService, ModePaiement, Boutique } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { X, Calendar as CalendarIcon, Zap, Store, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

interface OrderFormProps {
  initialOrder?: Order;
  onClose: () => void;
  userBoutique: Boutique;
  isAdmin: boolean;
  agentName: string;
}

export const OrderForm: React.FC<OrderFormProps> = ({ initialOrder, onClose, userBoutique, isAdmin, agentName }) => {
  const today = new Date().toISOString().split('T')[0];
  const defaultRetrait = new Date();
  defaultRetrait.setDate(defaultRetrait.getDate() + 4);
  const defaultRetraitStr = defaultRetrait.toISOString().split('T')[0];

  const [formData, setFormData] = useState<Partial<Order>>({
    numeroFacture: '',
    telephone: '',
    nomClient: '',
    civilite: 'Monsieur',
    montantTotal: 0,
    avancePayee: 0,
    reduction: 0,
    resteAPayer: 0,
    typeService: 'Lavage',
    modePaiement: 'Espèces',
    transactionId: '',
    dateDepot: today,
    dateRetraitPrevue: defaultRetraitStr,
    isExpress: false,
    boutiqueSource: userBoutique === 'Toutes' ? 'Senade' : userBoutique as any,
    agent_saisie: agentName,
    ...initialOrder
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingFacture, setIsCheckingFacture] = useState(false);
  const [factureError, setFactureError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<boolean>(false);

  // Check uniqueness of Numero Facture
  const checkFactureUniqueness = async (numero: string) => {
    if (!numero || initialOrder) return;
    
    setIsCheckingFacture(true);
    setFactureError(null);
    
    try {
      const q = query(collection(db, 'orders'), where('numeroFacture', '==', numero));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setFactureError('Ce numéro de facture existe déjà !');
      }
    } catch (err) {
      console.error("Error checking uniqueness:", err);
    } finally {
      setIsCheckingFacture(false);
    }
  };

  // Auto-calculate Reste à Payer
  useEffect(() => {
    const total = Number(formData.montantTotal) || 0;
    const avance = Number(formData.avancePayee) || 0;
    const reduction = Number(formData.reduction) || 0;
    setFormData(prev => ({ ...prev, resteAPayer: total - avance - reduction }));
  }, [formData.montantTotal, formData.avancePayee, formData.reduction]);

  // Handle Express change
  const handleExpressChange = (checked: boolean) => {
    const newRetrait = new Date(formData.dateDepot || today);
    if (checked) {
      newRetrait.setDate(newRetrait.getDate() + 1); // Express is 1 day
    } else {
      newRetrait.setDate(newRetrait.getDate() + 4); // Normal is 4 days
    }
    setFormData(prev => ({ 
      ...prev, 
      isExpress: checked, 
      dateRetraitPrevue: newRetrait.toISOString().split('T')[0] 
    }));
  };

  const isWithinServiceHours = () => {
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
    setSubmitError(false);

    if (!isAdmin && !isWithinServiceHours()) {
      toast.error("La boutique est fermée. Revenez demain à 06h00.");
      return;
    }

    if (factureError) {
      toast.error('Veuillez corriger le numéro de facture');
      return;
    }
    setIsSubmitting(true);

    // 5s Timeout for DB operation
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), 5000)
    );

    try {
      const getWeekNumber = (d: string) => {
        const date = new Date(d);
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay()||7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
        const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
        return date.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
      };

      const dateDepotStr = formData.dateDepot || today;

      const orderData = {
        ...formData,
        agent_saisie: agentName, // Ensure it's always up to date
        updatedAt: serverTimestamp(),
        mois: dateDepotStr.substring(0, 7), // YYYY-MM
        semaine: getWeekNumber(dateDepotStr), // YYYY-Wxx
      };

      const dbOperation = async () => {
        if (initialOrder?.id) {
          const orderRef = doc(db, 'orders', initialOrder.id);
          const { id, numeroFacture, createdAt, ...updateData } = orderData as Order;
          await updateDoc(orderRef, updateData);
          return 'UPDATED';
        } else {
          await addDoc(collection(db, 'orders'), {
            ...orderData,
            createdAt: serverTimestamp(),
            exporte: false
          });
          
          if (formData.montantTotal > 50000) {
            await addDoc(collection(db, 'notifications'), {
              type: 'LARGE_ORDER',
              message: `Nouvelle commande de ${formData.montantTotal} FCFA (Facture #${formData.numeroFacture})`,
              createdAt: serverTimestamp(),
              read: false
            });
          }
          return 'CREATED';
        }
      };

      const result = await Promise.race([dbOperation(), timeoutPromise]);
      
      if (result === 'UPDATED') toast.success('Commande mise à jour');
      else toast.success('Commande créée avec succès');
      
      onClose();
    } catch (err: any) {
      setSubmitError(true);
      if (err.message === 'TIMEOUT') {
        toast.error("Erreur réseau, réessayez dans un instant");
      } else {
        handleFirestoreError(err, OperationType.WRITE, initialOrder?.id ? `orders/${initialOrder.id}` : 'orders');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl border-2">
      <CardHeader className="flex flex-row items-center justify-between bg-muted/30 relative">
        <CardTitle className="text-2xl font-bold text-primary">
          {initialOrder ? `Modifier Facture #${initialOrder.numeroFacture}` : 'Nouvelle Commande'}
        </CardTitle>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="absolute top-[10px] right-[10px] h-11 w-11 rounded-full bg-black/20 p-2 text-black hover:bg-black/30 transition-colors z-50"
        >
          <X className="h-6 w-6 stroke-[3px]" />
        </Button>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="telephone">Téléphone (WhatsApp)</Label>
              <Input
                id="telephone"
                placeholder="Ex: 229XXXXXXXX"
                value={formData.telephone}
                onChange={e => setFormData({ ...formData, telephone: e.target.value })}
                required
                className="text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nomClient">Nom du Client</Label>
              <Input
                id="nomClient"
                placeholder="Nom complet"
                value={formData.nomClient}
                onChange={e => setFormData({ ...formData, nomClient: e.target.value })}
                required
                className="text-lg"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Civilité</Label>
              <RadioGroup 
                value={formData.civilite} 
                onValueChange={(val: 'Monsieur' | 'Dame') => setFormData({ ...formData, civilite: val })}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2 bg-slate-50 px-4 py-2 rounded-lg border cursor-pointer hover:bg-slate-100">
                  <RadioGroupItem value="Monsieur" id="monsieur" />
                  <Label htmlFor="monsieur" className="cursor-pointer font-bold">Monsieur</Label>
                </div>
                <div className="flex items-center space-x-2 bg-slate-50 px-4 py-2 rounded-lg border cursor-pointer hover:bg-slate-100">
                  <RadioGroupItem value="Dame" id="dame" />
                  <Label htmlFor="dame" className="cursor-pointer font-bold">Dame</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="numeroFacture">N° Facture (Carnet)</Label>
                {isCheckingFacture && (
                  <span className="text-xs text-blue-600 flex items-center gap-1 font-medium animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" /> Vérification en cours...
                  </span>
                )}
              </div>
              <div className="relative">
                <Input
                  id="numeroFacture"
                  placeholder="Ex: 1234"
                  value={formData.numeroFacture}
                  onChange={e => {
                    setFormData({ ...formData, numeroFacture: e.target.value });
                    setFactureError(null);
                  }}
                  onBlur={e => checkFactureUniqueness(e.target.value)}
                  disabled={!!initialOrder}
                  required
                  className={`text-lg font-mono ${factureError ? 'border-destructive bg-destructive/5' : ''}`}
                />
                {factureError && (
                  <div className="absolute -bottom-6 left-0 text-xs text-destructive flex items-center gap-1 font-bold">
                    <AlertCircle className="h-3 w-3" /> {factureError}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="montantTotal">Montant Total (FCFA)</Label>
              <Input
                id="montantTotal"
                type="number"
                value={formData.montantTotal}
                onChange={e => setFormData({ ...formData, montantTotal: Number(e.target.value) })}
                required
                className="text-lg font-semibold text-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avancePayee">Avance Payée (FCFA)</Label>
              <Input
                id="avancePayee"
                type="number"
                value={formData.avancePayee}
                onChange={e => setFormData({ ...formData, avancePayee: Number(e.target.value) })}
                required
                className="text-lg font-semibold text-green-600"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reduction">Réduction (FCFA)</Label>
              <Input
                id="reduction"
                type="number"
                value={formData.reduction}
                onChange={e => setFormData({ ...formData, reduction: Number(e.target.value) })}
                className="text-lg font-semibold text-orange-600"
              />
            </div>

            <div className="space-y-2">
              <Label>Type de Service</Label>
              <Select
                value={formData.typeService}
                onValueChange={(val: TypeService) => setFormData({ ...formData, typeService: val })}
              >
                <SelectTrigger className="text-lg">
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lavage">Lavage</SelectItem>
                  <SelectItem value="Repassage">Repassage</SelectItem>
                  <SelectItem value="Teinture">Teinture</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mode de Paiement</Label>
              <Select
                value={formData.modePaiement}
                onValueChange={(val: ModePaiement) => setFormData({ ...formData, modePaiement: val })}
              >
                <SelectTrigger className="text-lg">
                  <SelectValue placeholder="Choisir..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Espèces">Espèces</SelectItem>
                  <SelectItem value="MoMo Pay">MoMo Pay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Store className="h-4 w-4" /> Boutique Source
                </Label>
                <Select
                  value={formData.boutiqueSource}
                  onValueChange={(val: any) => setFormData({ ...formData, boutiqueSource: val })}
                >
                  <SelectTrigger className="text-lg">
                    <SelectValue placeholder="Choisir..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Senade">Senade</SelectItem>
                    <SelectItem value="Gankpodo">Gankpodo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.modePaiement === 'MoMo Pay' && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="transactionId">ID de Transaction (Optionnel)</Label>
                <Input
                  id="transactionId"
                  placeholder="Ex: 123456789"
                  value={formData.transactionId}
                  onChange={e => setFormData({ ...formData, transactionId: e.target.value })}
                  className="text-lg"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" /> Date de Dépôt
              </Label>
              <Input
                type="date"
                value={formData.dateDepot}
                onChange={e => setFormData({ ...formData, dateDepot: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" /> Retrait Prévu
              </Label>
              <Input
                type="date"
                value={formData.dateRetraitPrevue}
                onChange={e => setFormData({ ...formData, dateRetraitPrevue: e.target.value })}
                required
              />
            </div>

            <div className="md:col-span-2 flex items-center space-x-2 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <Checkbox 
                id="express" 
                checked={formData.isExpress} 
                onCheckedChange={(checked) => handleExpressChange(checked as boolean)}
              />
              <Label htmlFor="express" className="text-orange-800 font-bold flex items-center gap-2 cursor-pointer">
                <Zap className="h-5 w-5 fill-orange-500 text-orange-500" />
                COMMANDE EXPRESS (+ rapide)
              </Label>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Reste à Payer</Label>
              <div className="p-3 bg-muted rounded-md text-xl font-bold text-destructive border-2 border-destructive/20">
                {formData.resteAPayer} FCFA
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-4">
            {submitError && (
              <div className="p-4 bg-destructive/10 border border-destructive rounded-lg flex items-center justify-between">
                <span className="text-destructive font-bold">Erreur réseau détectée</span>
                <Button type="button" variant="destructive" size="sm" onClick={() => handleSubmit()}>
                  Réessayer
                </Button>
              </div>
            )}
            <div className="flex gap-4">
              <Button 
                type="submit" 
                className="flex-1 h-12 text-lg font-bold" 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Enregistrement...' : initialOrder ? 'Mettre à jour' : 'Valider la Commande'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                className="h-12 px-8" 
                onClick={onClose}
              >
                Annuler
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
