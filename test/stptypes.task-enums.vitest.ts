import { describe, it, expect } from 'vitest';
import * as StpType from '../src/stptypes';

/**
 * TaskWhat / TaskHow membership after STP-1001 and STP-1019.
 *
 * The engine renamed HARRASSMENT_FIRES to HARASSMENT_FIRES and stopped
 * producing the civilian-behaviour whats and the actor-class hows. The old
 * members stay (deprecated) so values from older servers or saved data still
 * compare; removing them is a next-major change, and this pins that they are
 * still here until then.
 */
describe('task enums (STP-1001, STP-1019)', () => {
  it('has the corrected HarassmentFires spelling', () => {
    expect(StpType.TaskWhat.HarassmentFires).toBe('harassment_fires');
  });

  it('keeps the deprecated TaskWhat members', () => {
    expect(StpType.TaskWhat.HarrassmentFires).toBe('harrassment_fires');
    expect(StpType.TaskWhat.Looting).toBe('looting');
    expect(StpType.TaskWhat.Rioting).toBe('rioting');
    expect(StpType.TaskWhat.SeekRefuge).toBe('seek_refuge');
  });

  it('keeps the deprecated TaskHow members', () => {
    expect(StpType.TaskHow.Civilian).toBe('civilian');
    expect(StpType.TaskHow.Insurgent).toBe('insurgent');
    expect(StpType.TaskHow.NgoOperation).toBe('ngo_operation');
  });
});
