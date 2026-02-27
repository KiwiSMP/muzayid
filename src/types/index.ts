export interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  color?: string
  mileage: number
  damage_type?: string
  fines_cleared?: boolean
  images?: string[]
  description?: string
  condition_report?: {
    reserve_price?: number
    run_drive_status?: 'starts_drives' | 'engine_starts' | 'non_runner'
    odometer_actual?: boolean
    keys_available?: boolean
    chassis_number?: string
    license_status?: 'active' | 'expired' | 'cancelled'
    location?: string
    lot_number?: string
    lane?: string
    primary_damage?: string
    secondary_damage?: string
    exterior?: string[]
    interior?: string[]
    mechanical?: string[]
    missing_parts?: string[]
    notes?: string
  }
  status?: string
}

export interface Auction {
  id: string
  vehicle_id: string
  status: 'upcoming' | 'active' | 'ended' | 'settled' | 'cancelled'
  start_time: string
  end_time: string
  starting_price: number
  current_highest_bid: number
  highest_bidder_id?: string
  lot_number?: string
  entry_fee?: number
  created_at: string
  reserve_price?: number
}

export interface AuctionWithVehicle extends Auction {
  vehicle: Vehicle | null
}

export interface UserProfile {
  id: string
  full_name: string
  email?: string
  phone_number?: string
  deposit_balance: number
  bidding_tier: number
  is_verified: boolean
  is_admin: boolean
  national_id_url?: string
  whatsapp_alerts?: boolean
  preferred_lang?: 'en' | 'ar'
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: 'new_car' | 'auction_start' | 'outbid' | 'won' | 'system'
  title: string
  body: string
  read: boolean
  related_auction_id?: string
  created_at: string
}

export interface Bid {
  id: string
  auction_id: string
  bidder_id: string
  amount: number
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  type: 'deposit' | 'withdrawal' | 'entry_fee' | 'refund' | 'settlement'
  amount: number
  status: 'pending' | 'completed' | 'rejected'
  notes?: string
  receipt_url?: string
  created_at: string
}
