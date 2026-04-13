import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserProfile, Order } from './types';
import { OrderList } from './components/OrderList';
import { OrderForm } from './components/OrderForm';
import { FinancialBilan } from './components/FinancialBilan';
import { CashManagement } from './components/CashManagement';
import { UserManagement } from './components/UserManagement';
import { MyCash } from './components/MyCash';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogIn, LogOut, Plus, WashingMachine, LayoutDashboard, ListTodo, Wallet, BarChart3, Users as UsersIcon, Store } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | undefined>();
  const [activeTab, setActiveTab] = useState('orders');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Simple profile listener without session/time restrictions
        const unsubscribeUser = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setUser(docSnap.data() as UserProfile);
          } else {
            // Fallback for new users if profile doesn't exist yet
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: firebaseUser.email === 'eulogehoussou9@gmail.com' ? 'admin' : 'secretaire',
              boutiqueAssignee: firebaseUser.email === 'eulogehoussou9@gmail.com' ? 'Toutes' : 'Senade',
              displayName: firebaseUser.displayName || '',
              isActive: true,
              isApproved: true,
              hasAcceptedContract: true
            });
          }
          setLoading(false);
        });
        return () => unsubscribeUser();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login Error:", err);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <WashingMachine className="h-12 w-12 animate-bounce text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md shadow-2xl border-2">
          <CardHeader className="text-center space-y-2">
            <WashingMachine className="mx-auto h-12 w-12 text-primary" />
            <CardTitle className="text-3xl font-black tracking-tight">PRESSING LA PAIX</CardTitle>
            <p className="text-muted-foreground">Espace de gestion multi-boutiques</p>
          </CardHeader>
          <CardContent className="pt-6">
            <Button onClick={handleLogin} className="w-full h-14 text-lg font-bold gap-3" size="lg">
              <LogIn className="h-6 w-6" />
              SE CONNECTER AVEC GOOGLE
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <Toaster position="top-center" />
      
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg">
              <WashingMachine className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tight">LA PAIX</h1>
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                <Store className="h-3 w-3" />
                {user.boutiqueAssignee}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-sm font-bold">{user.displayName}</span>
              <span className="text-[10px] uppercase font-black text-primary bg-primary/10 px-2 py-0.5 rounded">
                {user.role}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-destructive hover:bg-destructive/10">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-3xl font-black flex items-center gap-3">
              <LayoutDashboard className="h-8 w-8 text-primary" />
              Espace Travail
            </h2>
          </div>
          
          <Button 
            onClick={() => { setEditingOrder(undefined); setShowForm(true); }} 
            size="lg" 
            className="h-14 px-8 text-lg font-bold shadow-lg shadow-primary/20 gap-2"
          >
            <Plus className="h-6 w-6" />
            Nouvelle Commande
          </Button>
        </div>

        {showForm ? (
          <OrderForm 
            initialOrder={editingOrder} 
            onClose={() => { setShowForm(false); setEditingOrder(undefined); }} 
            userBoutique={user.boutiqueAssignee}
            isAdmin={user.role === 'admin'}
          />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-4 h-14 p-1 bg-muted/50 border-2">
              <TabsTrigger value="orders" className="text-sm md:text-lg font-bold gap-2">
                <ListTodo className="h-5 w-5" />
                Commandes
              </TabsTrigger>
              <TabsTrigger value="cash" className="text-sm md:text-lg font-bold gap-2">
                <Wallet className="h-5 w-5" />
                Caisse
              </TabsTrigger>
              {user.role === 'secretaire' && (
                <TabsTrigger value="mycash" className="text-sm md:text-lg font-bold gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Ma Caisse
                </TabsTrigger>
              )}
              {user.role === 'admin' && (
                <TabsTrigger value="bilan" className="text-sm md:text-lg font-bold gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Bilan
                </TabsTrigger>
              )}
              {user.role === 'admin' && (
                <TabsTrigger value="users" className="hidden md:flex text-lg font-bold gap-2">
                  <UsersIcon className="h-5 w-5" />
                  Équipe
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="orders" className="mt-0">
              <OrderList 
                isAdmin={user.role === 'admin'} 
                userBoutique={user.boutiqueAssignee}
                onEdit={(order) => { setEditingOrder(order); setShowForm(true); }} 
              />
            </TabsContent>

            <TabsContent value="cash" className="mt-0">
              <CashManagement 
                userBoutique={user.boutiqueAssignee}
                isAdmin={user.role === 'admin'}
              />
            </TabsContent>

            {user.role === 'secretaire' && (
              <TabsContent value="mycash" className="mt-0">
                <MyCash 
                  userBoutique={user.boutiqueAssignee}
                  userUid={user.uid}
                />
              </TabsContent>
            )}
            
            {user.role === 'admin' && (
              <TabsContent value="bilan" className="mt-0">
                <FinancialBilan 
                  userBoutique={user.boutiqueAssignee}
                  isAdmin={user.role === 'admin'}
                />
              </TabsContent>
            )}

            {user.role === 'admin' && (
              <TabsContent value="users" className="mt-0">
                <UserManagement />
              </TabsContent>
            )}
          </Tabs>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 md:hidden flex justify-around items-center z-40">
        <Button variant="ghost" size="icon" onClick={() => setActiveTab('orders')}><ListTodo /></Button>
        <Button variant="ghost" size="icon" onClick={() => setActiveTab('cash')}><Wallet /></Button>
        <Button onClick={() => setShowForm(true)} className="rounded-full h-12 w-12 shadow-lg"><Plus /></Button>
        <Button variant="ghost" size="icon" onClick={() => setActiveTab(user.role === 'admin' ? 'bilan' : 'mycash')}><BarChart3 /></Button>
      </footer>
    </div>
  );
}
