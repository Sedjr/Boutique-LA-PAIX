import React, { useState, useEffect, lazy, Suspense } from 'react';
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { UserProfile, Order, AdminAlert } from './types';
import { OrderList } from './components/OrderList';
import { Contract } from './components/Contract';
import { OrderForm } from './components/OrderForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
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
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | undefined>();
  const [activeTab, setActiveTab] = useState('orders');
  const [timeLockEnabled, setTimeLockEnabled] = useState(true);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

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
    let unsubscribeSettings: (() => void) | undefined;
    let unsubscribeAuth: (() => void) | undefined;
    let unsubscribeUser: (() => void) | undefined;
    let unsubscribeAlerts: (() => void) | undefined;

    // Startup Timeout Protocol
    const timer = setTimeout(() => {
      if (loading) {
        console.warn("Startup timeout reached. Clearing cache...");
        localStorage.clear();
        sessionStorage.clear();
        setTimeoutReached(true);
      }
    }, 10000);

    // 48-Hour Security Check (Auto-Logoff)
    const lastActivity = localStorage.getItem('lastActivity');
    if (lastActivity) {
      const lastActivityTime = parseInt(lastActivity);
      const fortyEightHours = 48 * 60 * 60 * 1000;
      if (Date.now() - lastActivityTime > fortyEightHours) {
        console.warn("Session expired (48h+). Forcing logout...");
        signOut(auth);
        localStorage.removeItem('lastActivity');
      }
    }

    // Fetch global settings
    unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setTimeLockEnabled(docSnap.data().timeLockEnabled ?? true);
      }
    }, (err) => {
      console.error("Settings listener error:", err);
    });

    unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Cleanup previous sub-listeners
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeAlerts) unsubscribeAlerts();

      if (firebaseUser) {
        // Update last activity for 48h check
        localStorage.setItem('lastActivity', Date.now().toString());

        const userRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeUser = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfile;
            
            // Direct Suspension Check
            if (!userData.isActive && userData.role !== 'admin') {
              handleLogout();
              return;
            }
            
            setUser(userData);
          } else {
            const isAdmin = firebaseUser.email === 'eulogehoussou9@gmail.com';
            const newUser: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: isAdmin ? 'admin' : 'secretaire',
              boutiqueAssignee: isAdmin ? 'Toutes' : 'Senade',
              displayName: firebaseUser.displayName || firebaseUser.email || '',
              isActive: true,
              isApproved: isAdmin,
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
        }, (err) => {
          console.error("User profile listener error:", err);
          setLoading(false);
        });
        
        if (firebaseUser.email === 'eulogehoussou9@gmail.com') {
          const alertsQuery = query(collection(db, 'alertes_admin'), where('lu', '==', false));
          unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
            setUnreadAlertsCount(snapshot.size);
          }, (err) => {
            console.error("Admin alerts listener error:", err);
          });
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(timer);
      if (unsubscribeSettings) unsubscribeSettings();
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeAlerts) unsubscribeAlerts();
    };
  }, []);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        toast.error("Le popup de connexion a été bloqué par votre navigateur. Veuillez autoriser les popups pour ce site.");
      } else if (err.code !== 'auth/popup-closed-by-user') {
        console.error("Login Error:", err);
        toast.error("Erreur de connexion : " + err.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setIsLoggingIn(true);

    try {
      if (loginMode === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;
        
        // Update Firebase Auth profile
        await updateProfile(firebaseUser, { displayName });

        // Create the user document in Firestore immediately
        const userRef = doc(db, 'users', firebaseUser.uid);
        const newUser: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          role: 'secretaire',
          boutiqueAssignee: 'Senade',
          displayName: displayName || firebaseUser.email || '',
          isActive: true,
          isApproved: false,
          hasAcceptedContract: false
        };
        await setDoc(userRef, newUser);

        // Create admin alert for new user
        await setDoc(doc(collection(db, 'alertes_admin')), {
          email: firebaseUser.email,
          heure: serverTimestamp(),
          appareil: navigator.userAgent,
          lu: false
        });

        toast.success("Compte créé ! Veuillez signer le contrat.");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("Connexion réussie !");
      }
    } catch (err: any) {
      console.error("Email Auth Error:", err);
      let message = "Une erreur est survenue";
      if (err.code === 'auth/email-already-in-use') {
        message = "Cet email est déjà utilisé. Basculement vers la connexion...";
        setLoginMode('login');
      }
      if (err.code === 'auth/operation-not-allowed') {
        message = "La connexion par Email/Mot de passe n'est pas activée dans votre console Firebase.";
      }
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') {
        message = "Email ou mot de passe incorrect. Veuillez vérifier vos identifiants.";
      }
      if (err.code === 'auth/invalid-email') {
        message = "Format d'email invalide.";
      }
      if (err.code === 'auth/weak-password') message = "Mot de passe trop faible (min 6 car.)";
      toast.error(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Veuillez saisir votre email pour réinitialiser le mot de passe.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Email de réinitialisation envoyé ! Vérifiez votre boîte de réception.");
    } catch (err: any) {
      console.error("Reset Password Error:", err);
      toast.error("Erreur : " + err.message);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleReset = async () => {
    try {
      await signOut(auth);
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    } catch (err) {
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background gap-6">
        <div className="relative">
          <WashingMachine className="h-16 w-16 animate-bounce text-primary" />
          <Loader2 className="h-20 w-20 animate-spin text-primary/20 absolute -top-2 -left-2" />
        </div>
        
        {timeoutReached && (
          <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <p className="text-muted-foreground font-bold px-6 text-center max-w-xs">
              La connexion semble lente ou bloquée...
            </p>
            <Button 
              variant="destructive" 
              onClick={handleReset}
              className="font-black h-12 px-8 shadow-lg shadow-destructive/20 uppercase"
            >
              Réinitialiser la session
            </Button>
          </div>
        )}
      </div>
    );
  }

  // 1. PRIORITY: SHOW LOGIN PAGE FIRST
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md shadow-2xl border-2">
          <CardHeader className="text-center space-y-2">
            <WashingMachine className="mx-auto h-12 w-12 text-primary" />
            <CardTitle className="text-3xl font-black tracking-tight">PRESSING LA PAIX</CardTitle>
            <p className="text-muted-foreground">Espace de gestion multi-boutiques</p>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <Button 
              onClick={handleLogin} 
              disabled={isLoggingIn}
              variant="outline"
              className="w-full h-12 font-bold gap-3 border-2" 
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              CONTINUER AVEC GOOGLE
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground font-bold">OU PAR EMAIL</span></div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {loginMode === 'register' && (
                <div className="space-y-2">
                  <Label htmlFor="reg-name">Nom Complet</Label>
                  <Input 
                    id="reg-name" 
                    placeholder="Votre nom" 
                    value={displayName} 
                    onChange={e => setDisplayName(e.target.value)} 
                    required 
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="exemple@gmail.com" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Mot de passe</Label>
                  {loginMode === 'login' && (
                    <button 
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                />
              </div>
              <Button type="submit" className="w-full h-12 font-bold" disabled={isLoggingIn}>
                {isLoggingIn ? <Loader2 className="animate-spin h-5 w-5" /> : (loginMode === 'login' ? 'SE CONNECTER' : 'CRÉER MON COMPTE')}
              </Button>
            </form>

            <div className="text-center">
              <button 
                onClick={() => setLoginMode(loginMode === 'login' ? 'register' : 'login')}
                className="text-sm font-bold text-primary hover:underline"
              >
                {loginMode === 'login' ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
              </button>
            </div>

            <p className="text-[10px] text-center text-muted-foreground font-medium">
              Si rien ne se passe avec Google, vérifiez que votre navigateur n'a pas bloqué le popup.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. SECURITY: CHECK IF ACCOUNT IS ACTIVE
  if (!user.isActive && user.role !== 'admin') {
    handleLogout();
    return null;
  }

  // 3. TIME LOCK: ONLY FOR SECRETARIES (ADMINS BYPASS)
  if (!isWithinServiceHours() && user.role !== 'admin') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <Store className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-black mb-2">LA BOUTIQUE EST FERMÉE</h1>
        <p className="text-muted-foreground font-bold">Revenez demain à 06h00.</p>
        <Button onClick={handleLogout} variant="ghost" className="mt-8">Se déconnecter</Button>
      </div>
    );
  }

  // 4. CONTRACT & APPROVAL
  if (!user.hasAcceptedContract && user.role !== 'admin') {
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
            <TabsList className="flex w-full h-14 p-1 bg-muted/50 border-2 overflow-x-auto overflow-y-hidden scrollbar-hide no-scrollbar">
              <TabsTrigger value="orders" className="flex-shrink-0 text-sm md:text-lg font-bold gap-2 px-4">
                <ListTodo className="h-4 w-4 md:h-5 md:h-5" />
                Commandes
              </TabsTrigger>
              <TabsTrigger value="cash" className="flex-shrink-0 text-sm md:text-lg font-bold gap-2 px-4">
                <Wallet className="h-4 w-4 md:h-5 md:h-5" />
                Caisse
              </TabsTrigger>
              {user.role === 'secretaire' && (
                <TabsTrigger value="mycash" className="flex-shrink-0 text-sm md:text-lg font-bold gap-2 px-4">
                  <BarChart3 className="h-4 w-4 md:h-5 md:h-5" />
                  Ma Caisse
                </TabsTrigger>
              )}
              {user.role === 'admin' && (
                <TabsTrigger value="bilan" className="flex-shrink-0 text-sm md:text-lg font-bold gap-2 px-4">
                  <BarChart3 className="h-4 w-4 md:h-5 md:h-5" />
                  Bilan
                </TabsTrigger>
              )}
              {user.role === 'admin' && (
                <TabsTrigger value="users" className="flex-shrink-0 text-sm md:text-lg font-bold gap-2 px-4 relative">
                  <UsersIcon className="h-4 w-4 md:h-5 md:h-5" />
                  Équipe
                  {unreadAlertsCount > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full border border-white animate-pulse" />
                  )}
                </TabsTrigger>
              )}
              {user.role === 'admin' && (
                <TabsTrigger value="settings" className="flex-shrink-0 text-sm md:text-lg font-bold gap-2 px-4">
                  <SettingsIcon className="h-4 w-4 md:h-5 md:h-5" />
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
