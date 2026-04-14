export type TypeService = 'Lavage' | 'Repassage' | 'Teinture';
export type ModePaiement = 'Espèces' | 'MoMo Pay';
export type UserRole = 'admin' | 'secretaire';
export type Boutique = 'Senade' | 'Gankpodo' | 'Toutes';
export type TypeMouvement = 'Dépense Boutique' | 'Prélèvement Patron' | 'Recette';

export interface Order {
  id?: string;
  numeroFacture: string;
  telephone: string;
  nomClient: string;
  civilite: 'Monsieur' | 'Dame';
  montantTotal: number;
  avancePayee: number;
  reduction: number;
  resteAPayer: number;
  typeService: TypeService;
  modePaiement: ModePaiement;
  transactionId?: string;
  dateDepot: string;
  dateRetraitPrevue: string;
  isExpress: boolean;
  boutiqueSource: Boutique;
  createdAt: any;
  updatedAt: any;
  agent_saisie?: string;
  exporte?: boolean;
  recuEnvoye?: boolean;
  envoyePar?: string;
  dateEnvoiRecu?: any;
  notifArriveeEnvoyee?: boolean;
  notifPar?: string;
  dateNotifArrivee?: any;
}

export interface CashMovement {
  id?: string;
  typeMouvement: TypeMouvement;
  montant: number;
  description: string;
  dateHeure: any;
  boutiqueSource: Boutique;
  createdBy: string;
  agent_saisie?: string;
  exporte?: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  boutiqueAssignee: Boutique;
  isApproved: boolean;
  isActive: boolean;
  hasAcceptedContract: boolean;
  currentSessionId?: string;
  displayName?: string;
}

export interface AppSettings {
  timeLockEnabled: boolean;
}

export interface AdminAlert {
  id?: string;
  email: string;
  heure: any;
  appareil: string;
  lu: boolean;
}
