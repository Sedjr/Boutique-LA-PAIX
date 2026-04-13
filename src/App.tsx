import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { UserProfile, Order, ConnectionLog } from './types';
import { OrderList } from './components/OrderList';
import { OrderForm } from './components/OrderForm';
import { FinancialBilan } from './components/FinancialBilan';
import { CashManagement } from './components/CashManagement';
import { UserManagement } from './components/UserManagement';
import { MyCash } from './components/MyCash';
import { ContractView } from './components/ContractView';
import { TimeLockView } from './components/TimeLockView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogIn, LogOut, Plus, WashingMachine, LayoutDashboard, Settings, User as UserIcon, BarChart3, ListTodo, Wallet, Users as UsersIcon, Store, AlertTriangle, Monitor } from 'lucide-react';
import { toast } from 'sonner';

// Generate a unique session ID for this browser instance
const SESSION_ID = crypto.randomUUID();

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | undefined>();
  const [activeTab, setActiveTab] = useState('orders');
  const [timeLockEnabled, setTimeLockEnabled] = useState(true);
  const [sessionConflict, setSessionConflict] = useState<UserProfile | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return "Android Device";
    if (/iPad|iPhone|iPod/.test(ua)) return "iOS Device";
    if (/Windows/i.test(ua)) return "Windows PC";
    if (/Mac/i.test(ua)) return "MacBook/iMac";
    return "Appareil Inconnu";
  };

  const logConnection = async (email: string, action: ConnectionLog['action']) => {
    try {
      await addDoc(collection(db, 'connectionLogs'), {
        email,
        action,
        dateHeure: serverTimestamp(),
        deviceInfo: getDeviceInfo()
      });

      if (action === 'Tentative Refusée') {
        // Trigger security alert notification for admin
        await addDoc(collection(db, 'notifications'), {
          type: 'SECURITY_ALERT',
          message: `Alerte : Tentative de connexion suspecte sur le compte ${email} depuis un appareil ${getDeviceInfo()} le ${new Date().toLocaleString()}.`,
          createdAt: serverTimestamp(),
          read: false
        });
      }
    } catch (err) {
      console.error("Error logging connection:", err);
    }
  };

  const handleLogout = async () => {
    if (user) {
      await logConnection(user.email, 'Déconnexion');
      await setDoc(doc(db, 'users', user.uid), { currentSessionId: null }, { merge: true });
    }
    signOut(auth);
    setSessionConflict(null);
  };

  useEffect(() => {
    // Real-time sync for global settings
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setTimeLockEnabled(snapshot.data().timeLockEnabled);
      }
    });

    // Periodic check every 5 minutes
    const interval = setInterval(() => {
      setUser(prev => prev ? { ...prev } : null);
    }, 300000);

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeSettings();
      unsubscribeAuth();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;

    const userRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribeUser = onSnapshot(userRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;

        // Session Control Logic
        if (data.currentSessionId && data.currentSessionId !== SESSION_ID) {
          // If we are already logged in but the ID changed, force logout
          if (user && user.currentSessionId === SESSION_ID) {
            toast.error("Session expirée : Connecté sur un autre appareil.");
            handleLogout();
            return;
          }
          // If we are just logging in and there's a conflict
          if (!user) {
            setSessionConflict(data);
            setLoading(false);
            return;
          }
        }

        // If no conflict or we are taking over
        if (!data.currentSessionId || data.currentSessionId === SESSION_ID) {
          if (!data.currentSessionId) {
            await setDoc(userRef, { currentSessionId: SESSION_ID }, { merge: true });
            await logConnection(data.email, 'Connexion');
          }
          
          if (!data.boutiqueAssignee || data.isApproved === undefined || data.isActive === undefined || data.hasAcceptedContract === undefined) {
            const updatedData = {
              ...data,
              boutiqueAssignee: data.boutiqueAssignee || (data.role === 'admin' ? 'Toutes' : 'Senade'),
              isApproved: data.isApproved ?? (data.role === 'admin'),
              isActive: data.isActive ?? true,
              hasAcceptedContract: data.hasAcceptedContract ?? (data.role === 'admin'),
              currentSessionId: SESSION_ID
            };
            await setDoc(userRef, updatedData, { merge: true });
            setUser(updatedData);
          } else {
            setUser(data);
          }
        }
      } else {
        const firebaseUser = auth.currentUser!;
        const isOwner = firebaseUser.email === 'eulogehoussou9@gmail.com';
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          role: isOwner ? 'admin' : 'secretaire',
          boutiqueAssignee: isOwner ? 'Toutes' : 'Senade',
          isApproved: isOwner,
          isActive: true,
          hasAcceptedContract: isOwner,
          displayName: firebaseUser.displayName || ''
        };
        await setDoc(userRef, newProfile);
        
        await addDoc(collection(db, 'notifications'), {
          type: 'NEW_USER',
          message: `Nouvel utilisateur inscrit: ${firebaseUser.email}`,
          createdAt: serverTimestamp(),
          read: false
        });
        
        setUser(newProfile);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error listening to user profile:", err);
      setLoading(false);
    });

    return () => unsubscribeUser();
  }, [auth.currentUser?.uid, user?.currentSessionId]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success('Connexion réussie');
    } catch (err) {
      console.error(err);
      toast.error('Erreur de connexion');
    }
  };

  const handleTakeOverSession = async () => {
    if (!auth.currentUser || !sessionConflict) return;
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, { currentSessionId: SESSION_ID }, { merge: true });
      await logConnection(sessionConflict.email, 'Connexion');
      setSessionConflict(null);
      // The onSnapshot will trigger and set the user
    } catch (err) {
      toast.error("Erreur lors de la reprise de session");
    }
  };

  const handleRejectSession = async () => {
    if (sessionConflict) {
      await logConnection(sessionConflict.email, 'Tentative Refusée');
    }
    handleLogout();
  };

  const handleAcceptContract = async () => {
    if (!user) return;
    try {
      const updatedUser = { ...user, hasAcceptedContract: true };
      await setDoc(doc(db, 'users', user.uid), { hasAcceptedContract: true }, { merge: true });
      
      // Notify Admin
      await addDoc(collection(db, 'notifications'), {
        type: 'CONTRACT_ACCEPTED',
        message: `La secrétaire ${user.displayName || user.email} a signé le contrat et attend votre validation.`,
        createdAt: serverTimestamp(),
        read: false
      });
      
      setUser(updatedUser);
      toast.success('Contrat accepté. En attente de validation par l\'administrateur.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const isWithinServiceHours = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const time = hours * 60 + minutes;
    
    const start = 6 * 60; // 06:00
    const end = 22 * 60 + 30; // 22:30
    
    return time >= start && time <= end;
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <WashingMachine className="h-12 w-12 animate-bounce text-primary" />
          <p className="text-muted-foreground font-medium">Chargement de l'espace de travail...</p>
        </div>
      </div>
    );
  }

  if (sessionConflict) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md shadow-2xl border-2 border-orange-200">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-10 w-10 text-orange-600" />
            </div>
            <CardTitle className="text-2xl font-black tracking-tight">SESSION ACTIVE</CardTitle>
            <CardDescription>
              Ce compte est déjà connecté sur un autre appareil.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg flex items-start gap-3">
              <Monitor className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="text-sm">
                <p className="font-bold">Appareil actif détecté</p>
                <p className="text-muted-foreground">Voulez-vous déconnecter l'autre appareil et continuer ici ?</p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button onClick={handleTakeOverSession} className="w-full h-12 font-bold">Déconnecter l'autre et continuer</Button>
            <Button onClick={handleRejectSession} variant="outline" className="w-full h-12 font-bold">Annuler</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md shadow-2xl border-2">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mb-4">
              <WashingMachine className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tight">PRESSING LA PAIX</CardTitle>
            <p className="text-muted-foreground">Espace de gestion multi-boutiques</p>
          </CardHeader>
          <CardContent className="pt-6">
            <Button onClick={handleLogin} className="w-full h-14 text-lg font-bold gap-3" size="lg">
              <LogIn className="h-6 w-6" />
              Se connecter avec Google
            </Button>
            <p className="mt-6 text-xs text-center text-muted-foreground">
              Accès sécurisé par rôle et boutique.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md shadow-2xl border-2">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto bg-destructive/10 w-20 h-20 rounded-full flex items-center justify-center mb-4">
              <UserIcon className="h-10 w-10 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-black tracking-tight">COMPTE SUSPENDU</CardTitle>
            <p className="text-muted-foreground">Votre compte a été désactivé par l'administrateur.</p>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <Button onClick={handleLogout} variant="outline" className="w-full">Se déconnecter</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user.hasAcceptedContract) {
    return <ContractView userName={user.displayName || user.email} onAccept={handleAcceptContract} onLogout={handleLogout} />;
  }

  if (!user.isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md shadow-2xl border-2">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mb-4">
              <UserIcon className="h-10 w-10 text-orange-600" />
            </div>
            <CardTitle className="text-2xl font-black tracking-tight">ACCÈS EN ATTENTE</CardTitle>
            <p className="text-muted-foreground">Votre contrat a été signé. Votre compte doit maintenant être approuvé par l'administrateur.</p>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="bg-muted p-4 rounded-lg text-sm">
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Contrat:</strong> Signé</p>
              <p><strong>Approbation:</strong> En attente</p>
            </div>
            <Button onClick={handleLogout} variant="outline" className="w-full">Se déconnecter</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (timeLockEnabled && !isWithinServiceHours() && user.role !== 'admin') {
    return <TimeLockView onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <Toaster position="top-center" />
      
      {/* Header */}
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
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 border">
              <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`} />
              <span className="text-[10px] font-black uppercase tracking-wider">
                {isOnline ? 'Connecté' : 'Hors-ligne'}
              </span>
            </div>

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
        {/* Dashboard Stats / Actions */}
        <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-3xl font-black flex items-center gap-3">
              <LayoutDashboard className="h-8 w-8 text-primary" />
              Espace Travail
            </h2>
            <p className="text-muted-foreground">
              {user.role === 'admin' ? 'Gestion consolidée de toutes les boutiques.' : `Gestion de la boutique ${user.boutiqueAssignee}.`}
            </p>
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

        {/* Main Content */}
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
              <TabsTrigger value="orders" className="text-sm md:text-lg font-bold gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <ListTodo className="h-4 w-4 md:h-5 md:w-5" />
                <span className="hidden sm:inline">Commandes</span>
                <span className="sm:hidden">Cmds</span>
              </TabsTrigger>
              <TabsTrigger value="cash" className="text-sm md:text-lg font-bold gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Wallet className="h-4 w-4 md:h-5 md:w-5" />
                Caisse
              </TabsTrigger>
              {user.role === 'secretaire' && (
                <TabsTrigger value="mycash" className="text-sm md:text-lg font-bold gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <BarChart3 className="h-4 w-4 md:h-5 md:w-5" />
                  Ma Caisse
                </TabsTrigger>
              )}
              {user.role === 'admin' && (
                <TabsTrigger value="bilan" className="text-sm md:text-lg font-bold gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <BarChart3 className="h-4 w-4 md:h-5 md:w-5" />
                  Bilan
                </TabsTrigger>
              )}
              {user.role === 'admin' && (
                <TabsTrigger value="users" className="hidden md:flex text-lg font-bold gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
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

      {/* Footer / Mobile Nav */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 md:hidden flex justify-around items-center z-40">
        <Button variant="ghost" size="icon" className={activeTab === 'orders' ? 'text-primary' : 'text-muted-foreground'} onClick={() => setActiveTab('orders')}><ListTodo /></Button>
        <Button variant="ghost" size="icon" className={activeTab === 'cash' ? 'text-primary' : 'text-muted-foreground'} onClick={() => setActiveTab('cash')}><Wallet /></Button>
        <Button onClick={() => setShowForm(true)} className="rounded-full h-12 w-12 shadow-lg"><Plus /></Button>
        {user.role === 'admin' ? (
          <Button variant="ghost" size="icon" className={activeTab === 'bilan' ? 'text-primary' : 'text-muted-foreground'} onClick={() => setActiveTab('bilan')}><BarChart3 /></Button>
        ) : (
          <Button variant="ghost" size="icon" className={activeTab === 'mycash' ? 'text-primary' : 'text-muted-foreground'} onClick={() => setActiveTab('mycash')}><BarChart3 /></Button>
        )}
      </footer>
    </div>
  );
}
