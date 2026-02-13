/**
 * @file Contains the domain model for FCOM/PCOM entities.
 *
 * This file defines the core classes that represent the business objects
 * within the COM (Component Object Model) domain, such as Processors,
 * Event Objects, and the COM files themselves.
 *
 * This is the first step in establishing a rich, object-oriented Domain Model
 * as described in the architectural plan (gemini.md).
 */

export enum ProcessorType {
  Set = 'set',
  Regex = 'regex',
  Math = 'math',
  // Add other processor types as they are identified
}

export interface IProcessorConfig {
  type: ProcessorType;
  field: string;
  // Other properties will be added here
}

/**
 * Represents a single processor within an FCOM/PCOM file.
 *
 * A processor is a single operation that modifies an event. This class
 * will encapsulate the logic for validating and serializing processors.
 */
export class Processor {
  public readonly type: ProcessorType;
  public field: string;

  constructor(config: IProcessorConfig) {
    this.type = config.type;
    this.field = config.field;
  }

  /**
   * Validates that the processor has all required fields for its type.
   * @returns {boolean} True if valid.
   * @throws {Error} If invalid.
   */
  public validate(): boolean {
    if (!this.type || !this.field) {
      throw new Error('Processor must have a type and a field.');
    }
    // More complex validation logic will be added here.
    return true;
  }

  /**
   * Converts the processor object back to its plain JSON representation for storage.
   */
  public toJSON(): object {
    return {
      type: this.type,
      field: this.field,
    };
  }
}
