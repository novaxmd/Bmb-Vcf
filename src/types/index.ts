export interface Contact {
  id?: string | number;
  name: string | null;
  phone: string;
  created_at?: string;
}

export interface Country {
  name: string;
  code: string;
}

export interface CountResponse {
  count: number;
}

export interface UploadResponse {
  success?: boolean;
  exists?: boolean;
  inserted?: Contact;
  error?: string;
}

export interface AdminLoginResponse {
  success: boolean;
  token?: string;
  error?: string;
}

export interface ListResponse {
  contacts?: Contact[];
  error?: string;
}
