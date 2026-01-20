declare module "lob" {
  interface LobOptions {
    apiKey: string;
  }

  interface Address {
    name?: string;
    company?: string;
    address_line1: string;
    address_line2?: string;
    address_city: string;
    address_state: string;
    address_zip: string;
    address_country?: string;
  }

  interface LetterCreateOptions {
    description?: string;
    to: Address;
    from: Address;
    file: string | Buffer;
    color?: boolean;
    double_sided?: boolean;
    address_placement?: "top_first_page" | "insert_blank_page";
    return_envelope?: boolean;
    perforated_page?: number;
    mail_type?: "usps_first_class" | "usps_standard";
    extra_service?: "certified" | "certified_return_receipt" | "registered";
    merge_variables?: Record<string, string>;
    metadata?: Record<string, string>;
  }

  interface Letter {
    id: string;
    description?: string;
    metadata?: Record<string, string>;
    to: Address;
    from: Address;
    color: boolean;
    double_sided: boolean;
    address_placement: string;
    return_envelope: boolean;
    perforated_page?: number;
    mail_type: string;
    extra_service?: string;
    url: string;
    carrier: string;
    tracking_number?: string;
    tracking_events?: TrackingEvent[];
    expected_delivery_date: string;
    date_created: string;
    date_modified: string;
    send_date: string;
    object: "letter";
  }

  interface TrackingEvent {
    id: string;
    time: string;
    type: string;
    name: string;
    location?: string;
    object: "tracking_event";
  }

  interface Letters {
    create(options: LetterCreateOptions): Promise<Letter>;
    retrieve(id: string): Promise<Letter>;
    delete(id: string): Promise<{ id: string; deleted: boolean }>;
    cancel(id: string): Promise<{ id: string; deleted: boolean }>;
    list(params?: { limit?: number; offset?: number }): Promise<{
      data: Letter[];
      count: number;
      object: string;
    }>;
  }

  interface UsVerificationOptions {
    primary_line: string;
    secondary_line?: string;
    city: string;
    state: string;
    zip_code: string;
  }

  interface UsVerification {
    id: string;
    recipient?: string;
    primary_line: string;
    secondary_line: string;
    urbanization: string;
    last_line: string;
    deliverability: "deliverable" | "deliverable_unnecessary_unit" | "deliverable_incorrect_unit" | "deliverable_missing_unit" | "undeliverable";
    components: {
      primary_number: string;
      street_predirection: string;
      street_name: string;
      street_suffix: string;
      street_postdirection: string;
      secondary_designator: string;
      secondary_number: string;
      pmb_designator: string;
      pmb_number: string;
      extra_secondary_designator: string;
      extra_secondary_number: string;
      city: string;
      state: string;
      zip_code: string;
      zip_code_plus_4: string;
      zip_code_type: string;
      delivery_point_barcode: string;
      address_type: string;
      record_type: string;
      default_building_address: boolean;
      county: string;
      county_fips: string;
      carrier_route: string;
      carrier_route_type: string;
      latitude?: number;
      longitude?: number;
    };
    object: "us_verification";
  }

  interface UsVerifications {
    verify(options: UsVerificationOptions): Promise<UsVerification>;
  }

  class Lob {
    constructor(options: LobOptions);
    letters: Letters;
    usVerifications: UsVerifications;
  }

  export default Lob;
}
