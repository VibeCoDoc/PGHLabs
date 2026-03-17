export interface LabRequest {
  name: string;
  ward_location: string;
  age_sex: string;
  birthday: string;
  case_number: string;
  diagnosis: string;
  requested_by: string;
  date_collected: string;
  time_collected: string;
  collected_by: string;
  specimen_type: string;
  site_of_collection: string;
  form_type: string;
  tube_top: string;
  requests_list: string;
}

export interface MaterialDetail {
  count: number;
  tests: string[];
}

export interface Reminder {
  text: string;
  critical: boolean;
  type?: string;
}
