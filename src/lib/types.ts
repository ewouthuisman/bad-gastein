export type Difficulty = 'novice' | 'easy' | 'intermediate' | 'advanced' | 'expert' | 'freeride';

export interface Profile {
  id: string;
  display_name: string;
  color: string;
  role: 'admin' | 'member';
  max_difficulty: 'novice' | 'easy' | 'intermediate' | 'advanced';
}
