import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { Order, Boutique, CashMovement } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Wallet, Clock, Calendar as CalendarIcon, PieChart, Store, ArrowDownCircle, ArrowUpCircle, Banknote, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface FinancialBilanProps {
  userBoutique: Boutique;
  isAdmin: boolean;
}

export const FinancialBilan: React.FC<FinancialBilanProps> = ({ userBoutique, isAdmin }) => {
  const [viewBoutique, setViewBoutique] = useState<Boutique>(userBoutique === 'Toutes' ? 'Toutes' : userBoutique);
  
  // By default: current month (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().substring(0, 7)
  );

  const [orders, setOrders] = useState<Order[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [stats, setStats] = useState({
    recettes: 0, // Avances + Soldes payés
    creances: 0, // Reste à payer
    fluxTresorerie: 0, // Recettes du jour - Dépenses du jour
    caTotal: 0,
    depenses: 0,
    prelevements: 0,
    volumeSenade: 0,
    volumeGankpodo: 0
  });

  useEffect(() => {
    let qOrders = query(collection(db, 'orders'), where('mois', '==', selectedMonth));
    let qMovements = query(collection(db, 'cashMovements'), where('mois', '==', selectedMonth));

    // If not admin, filter by assigned boutique (extra safety)
    if (!isAdmin && userBoutique !== 'Toutes') {
      qOrders = query(collection(db, 'orders'), 
        where('mois', '==', selectedMonth),
        where('boutiqueSource', '==', userBoutique)
      );
      qMovements = query(collection(db, 'cashMovements'), 
        where('mois', '==', selectedMonth),
        where('boutiqueSource', '==', userBoutique)
      );
    }

    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      setOrders(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    const unsubMovements = onSnapshot(qMovements, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CashMovement[];
      setMovements(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cashMovements');
    });

    return () => { unsubOrders(); unsubMovements(); };
  }, [isAdmin, userBoutique, selectedMonth]);

  useEffect(() => {
    calculateStats();
  }, [orders, movements, viewBoutique]);

  const calculateStats = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const filteredOrders = viewBoutique === 'Toutes' ? orders : orders.filter(o => o.boutiqueSource === viewBoutique);
    const filteredMovements = viewBoutique === 'Toutes' ? movements : movements.filter(m => m.boutiqueSource === viewBoutique);

    let recettes = 0;
    let creances = 0;
    let caTotal = 0;
    let depenses = 0;
    let prelevements = 0;
    let fluxTresorerie = 0;

    filteredOrders.forEach(order => {
      caTotal += order.montantTotal;
      creances += order.resteAPayer;
      // Recettes = Ce qui a été payé (Total - Reste)
      recettes += (order.montantTotal - order.resteAPayer);
    });

    filteredMovements.forEach(m => {
      const mDate = m.dateHeure?.toDate() || new Date();
      const mDateStr = mDate.toISOString().split('T')[0];

      if (m.typeMouvement === 'Dépense Boutique') {
        depenses += m.montant;
        if (mDateStr === today) fluxTresorerie -= m.montant;
      } else if (m.typeMouvement === 'Prélèvement Patron') {
        prelevements += m.montant;
        if (mDateStr === today) fluxTresorerie -= m.montant;
      } else if (m.typeMouvement === 'Recette') {
        // Les recettes directes en caisse (si on en ajoute manuellement)
        if (mDateStr === today) fluxTresorerie += m.montant;
      }
    });

    // Ajouter les recettes des commandes du jour au flux de trésorerie
    filteredOrders.forEach(order => {
      const orderDate = order.dateDepot; // Format YYYY-MM-DD
      if (orderDate === today) {
        fluxTresorerie += (order.montantTotal - order.resteAPayer);
      }
    });

    const volumeSenade = orders.filter(o => o.boutiqueSource === 'Senade').length;
    const volumeGankpodo = orders.filter(o => o.boutiqueSource === 'Gankpodo').length;

    setStats({
      recettes,
      creances,
      fluxTresorerie,
      caTotal,
      depenses,
      prelevements,
      volumeSenade,
      volumeGankpodo
    });
  };

  const chartData = [
    { name: 'Sénade', volume: stats.volumeSenade, color: '#3b82f6' },
    { name: 'Gankpodo', volume: stats.volumeGankpodo, color: '#8b5cf6' }
  ];

  return (
    <div className="space-y-8">
      {/* Month & Boutique Selectors */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        {isAdmin && (
          <Tabs value={viewBoutique} onValueChange={(val) => setViewBoutique(val as Boutique)} className="flex-1 w-full">
            <TabsList className="grid w-full grid-cols-3 h-14 p-1 bg-muted/50 border-2">
              <TabsTrigger value="Toutes" className="text-lg font-bold gap-2">
                <Store className="h-5 w-5" /> Vue Globale
              </TabsTrigger>
              <TabsTrigger value="Senade" className="text-lg font-bold gap-2">
                <Store className="h-5 w-5" /> Sénade
              </TabsTrigger>
              <TabsTrigger value="Gankpodo" className="text-lg font-bold gap-2">
                <Store className="h-5 w-5" /> Gankpodo
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        
        <div className="w-full md:w-64">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-14 text-lg font-bold">
              <CalendarIcon className="mr-2 h-5 w-5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 6 }).map((_, i) => {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const val = d.toISOString().substring(0, 7);
                const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(d);
                return <SelectItem key={val} value={val} className="capitalize font-medium">{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 border-blue-200 bg-blue-50/30 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-black text-blue-700 uppercase tracking-widest">Chiffre d'Affaires</CardTitle>
            <TrendingUp className="h-6 w-6 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-blue-600">{stats.caTotal.toLocaleString()} F</div>
            <p className="text-xs text-blue-600/60 mt-1 font-bold">Volume total des commandes</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-green-50/30 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-black text-green-700 uppercase tracking-widest">Recettes (Encaissé)</CardTitle>
            <Banknote className="h-6 w-6 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-green-600">{stats.recettes.toLocaleString()} F</div>
            <p className="text-xs text-green-600/60 mt-1 font-bold">Avances + Soldes perçus</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-orange-200 bg-orange-50/30 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-black text-orange-700 uppercase tracking-widest">Créances Clients</CardTitle>
            <Users className="h-6 w-6 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-orange-600">{stats.creances.toLocaleString()} F</div>
            <p className="text-xs text-orange-600/60 mt-1 font-bold">Reste à payer total</p>
          </CardContent>
        </Card>
      </div>

      {/* Flux de Trésorerie & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-2 border-primary/20 shadow-xl">
          <CardHeader className="bg-primary/5 border-b">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Wallet className="h-6 w-6" /> Flux de Trésorerie du Jour
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className={`text-5xl font-black tracking-tighter ${stats.fluxTresorerie >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {stats.fluxTresorerie.toLocaleString()} FCFA
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs">Solde Net Aujourd'hui</p>
              <p className="text-sm text-slate-500">(Recettes du jour - Dépenses/Retraits)</p>
            </div>
            <div className="w-full grid grid-cols-2 gap-4 pt-6 border-t">
              <div className="text-left">
                <p className="text-[10px] font-black text-muted-foreground uppercase">Dépenses</p>
                <p className="text-lg font-bold text-orange-600">-{stats.depenses.toLocaleString()} F</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-muted-foreground uppercase">Retraits Patron</p>
                <p className="text-lg font-bold text-purple-600">-{stats.prelevements.toLocaleString()} F</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-xl">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-sm font-black uppercase tracking-widest">Comparaison Volume Commandes</CardTitle>
          </CardHeader>
          <CardContent className="pt-8 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="volume" radius={[8, 8, 0, 0]} barSize={60}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

