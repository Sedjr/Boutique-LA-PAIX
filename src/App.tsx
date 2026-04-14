import React, { useState, useEffect, lazy, Suspense } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { UserProfile, Order, AdminAlert } from './types';
import { OrderList } from './components/OrderList';
import { Contract } from './components/Contract';
import { OrderForm } from './components/OrderForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogIn, LogOut, Plus, WashingMachine, LayoutDashboard, ListTodo, Wallet, BarChart3, Users as UsersIcon, Store, Settings as SettingsIcon, Loader2 } from 'lucide-react';

// Lazy load tab components
const FinancialBilan = lazy(() => import('./components/FinancialBilan').then(m => ({ default: m.FinancialBilan })));
const CashManagement = lazy(() => import('./components/CashManagement').then(m => ({ default: m.CashManagement })));
const UserManagement = lazy(() => import('./components/UserManagement').then(m => ({ default: m.UserManagement })));
const MyCash = lazy(() => import('./components/MyCash').then(m => ({ default: m.MyCash })));
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | undefined>();
  const [activeTab, setActiveTab] = useState('orders');
  const [timeLockEnabled, setTimeLockEnabled] = useState(true);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);

  const isWithinServiceHours = () => {
    if (!timeLockEnabled) return true; // Admin override

    const now = new Date();
    const day = now.getDay(); // 0 is Sunday
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const time = hours * 60 + minutes;
    
    if (day === 0) return false; // Closed on Sunday
    
    const start = 6 * 60; // 06:00
    const end = 22 * 60 + 30; // 22:30
    
    return time >= start && time <= end;
  };

  useEffect(() => {
    // Fetch global settings
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setTimeLockEnabled(docSnap.data().timeLockEnabled ?? true);
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const unsubscribeUser = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            setUser(docSnap.data() as UserProfile);
          } else {
            // New user creation
            const isAdmin = firebaseUser.email === 'eulogehoussou9@gmail.com';
            const newUser: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: isAdmin ? 'admin' : 'secretaire',
              boutiqueAssignee: isAdmin ? 'Toutes' : 'Senade',
              displayName: firebaseUser.displayName || firebaseUser.email || '',
              isActive: true,
              isApproved: isAdmin, // Only admin is auto-approved
              hasAcceptedContract: false
            };
            
            await setDoc(userRef, newUser);
            
            // Create admin alert for new user
            if (!isAdmin) {
              await setDoc(doc(collection(db, 'alertes_admin')), {
                email: firebaseUser.email,
                heure: serverTimestamp(),
                appareil: navigator.userAgent,
                lu: false
              });
            }
            
            setUser(newUser);
          }
          setLoading(false);
        });
        
        // Listen for alerts if admin
        if (firebaseUser.email === 'eulogehoussou9@gmail.com') {
          const alertsQuery = query(collection(db, 'alertes_admin'), where('lu', '==', false));
          const unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
            setUnreadAlertsCount(snapshot.size);
          });
          return () => {
            unsubscribeUser();
            unsubscribeAlerts();
          };
        }

        return () => unsubscribeUser();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeSettings();
      unsubscribeAuth();
    };
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

  // Time-based access control (Admins bypass this)
  if (!isWithinServiceHours() && user?.role !== 'admin') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <Store className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-black mb-2">LA BOUTIQUE EST FERMÉE</h1>
        <p className="text-muted-foreground font-bold">Revenez demain à 06h00.</p>
        {user && <Button onClick={handleLogout} variant="ghost" className="mt-8">Se déconnecter</Button>}
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

  if (user && !user.isActive && user.role !== 'admin') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="bg-destructive/10 p-6 rounded-full mb-6">
          <Lock className="h-16 w-16 text-destructive" />
        </div>
        <h1 className="text-3xl font-black mb-4 text-destructive">COMPTE SUSPENDU</h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto mb-8">
          Votre accès a été suspendu par l'administrateur. Veuillez contacter <span className="font-black text-primary">Euloge Houssou</span>.
        </p>
        <Button onClick={handleLogout} variant="outline" className="h-12 px-8 font-bold gap-2">
          <LogOut className="h-5 w-5" />
          Se déconnecter
        </Button>
      </div>
    );
  }

  if (user && !user.hasAcceptedContract && user.role !== 'admin') {
    return (
      <Contract 
        userUid={user.uid} 
        onAccept={() => {}} // State will update via onSnapshot
        onLogout={handleLogout} 
      />
    );
  }

  if (user && !user.isApproved && user.role !== 'admin') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="bg-orange-100 p-6 rounded-full mb-6">
          <Lock className="h-16 w-16 text-orange-600" />
        </div>
        <h1 className="text-3xl font-black mb-4">ACCÈS EN ATTENTE</h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto mb-8">
          Votre contrat est signé. Votre compte est maintenant en attente de validation finale par <span className="font-black text-primary">Euloge Houssou</span>.
        </p>
        <Button onClick={handleLogout} variant="outline" className="h-12 px-8 font-bold gap-2">
          <LogOut className="h-5 w-5" />
          Se déconnecter
        </Button>
      </div>
    );
  }

  const agentName = user.displayName || user.email;

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
              <span className="text-sm font-bold">{agentName}</span>
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
            agentName={agentName}
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
                <TabsTrigger value="users" className="hidden md:flex text-lg font-bold gap-2 relative">
                  <UsersIcon className="h-5 w-5" />
                  Équipe
                  {unreadAlertsCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full border-2 border-white animate-pulse" />
                  )}
                </TabsTrigger>
              )}
              {user.role === 'admin' && (
                <TabsTrigger value="settings" className="text-sm md:text-lg font-bold gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  Paramètres
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="orders" className="mt-0">
              {activeTab === 'orders' && (
                <OrderList 
                  isAdmin={user.role === 'admin'} 
                  userBoutique={user.boutiqueAssignee}
                  agentName={agentName}
                  onEdit={(order) => { setEditingOrder(order); setShowForm(true); }} 
                />
              )}
            </TabsContent>

            <TabsContent value="cash" className="mt-0">
              {activeTab === 'cash' && (
                <Suspense fallback={<div className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></div>}>
                  <CashManagement 
                    userBoutique={user.boutiqueAssignee}
                    isAdmin={user.role === 'admin'}
                    agentName={agentName}
                    timeLockEnabled={timeLockEnabled}
                  />
                </Suspense>
              )}
            </TabsContent>

            {user.role === 'secretaire' && (
              <TabsContent value="mycash" className="mt-0">
                {activeTab === 'mycash' && (
                  <Suspense fallback={<div className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></div>}>
                    <MyCash 
                      userBoutique={user.boutiqueAssignee}
                      userUid={user.uid}
                    />
                  </Suspense>
                )}
              </TabsContent>
            )}
            
            {user.role === 'admin' && (
              <TabsContent value="bilan" className="mt-0">
                {activeTab === 'bilan' && (
                  <Suspense fallback={<div className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></div>}>
                    <FinancialBilan 
                      userBoutique={user.boutiqueAssignee}
                      isAdmin={user.role === 'admin'}
                    />
                  </Suspense>
                )}
              </TabsContent>
            )}

            {user.role === 'admin' && (
              <TabsContent value="users" className="mt-0">
                {activeTab === 'users' && (
                  <Suspense fallback={<div className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></div>}>
                    <UserManagement />
                  </Suspense>
                )}
              </TabsContent>
            )}

            {user.role === 'admin' && (
              <TabsContent value="settings" className="mt-0">
                {activeTab === 'settings' && (
                  <Suspense fallback={<div className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></div>}>
                    <Settings />
                  </Suspense>
                )}
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
