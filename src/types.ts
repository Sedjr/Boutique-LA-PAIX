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
  noteVocaleUrl?: string;
  createdAt: any;
  updatedAt: any;
}

export interface CashMovement {
  id?: string;
  typeMouvement: TypeMouvement;
  montant: number;
  description: string;
  dateHeure: any;
  boutiqueSource: Boutique;
  createdBy: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  boutiqueAssignee: Boutique;
  isApproved: boolean;
  isActive: boolean;
  hasAcceptedContract: boolean;
  displayName?: string;
}

export interface AppSettings {
  timeLockEnabled: boolean;
}
