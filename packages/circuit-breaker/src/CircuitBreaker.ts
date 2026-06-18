import { logger } from "@repo/logger";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
    name: string;
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    failureRateThreshold?: number;
    minimumRequests?: number;
}

export interface CircuitBreakerMetrics {
    state: CircuitState;
    totalRequests: number;
    totalFailures: number;
    totalSuccesses: number;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    failureRate: number;
    lastStateChange: number;
    nextAttemptTime: number | null;
}

export class CircuitBreakerOpenError extends Error {
    constructor(name: string, nextAttemptTime: number) {
      const waitTime = Math.ceil((nextAttemptTime - Date.now()) / 1000);
      super(
        `Circuit breaker "${name}" is OPEN. Service unavailable. Retry in 
  ${waitTime}s`
      );
      this.name = "CircuitBreakerOpenError";
    }
  }

  export class CircuitBreaker {
    private state: CircuitState = "CLOSED";
    private failureCount: number = 0;
    private successCount: number = 0;
    private nextAttemptTime: number = 0;

    // Metrics
    private totalRequests: number = 0;
    private totalFailures: number = 0;
    private totalSuccesses: number = 0;
    private lastStateChange: number = Date.now();

    // Configuration
    private readonly config: Required<CircuitBreakerConfig>;

    constructor(config: CircuitBreakerConfig) {
      // Set defaults for optional config
      this.config = {
        ...config,
        failureRateThreshold: config.failureRateThreshold ?? 0.5,
        minimumRequests: config.minimumRequests ?? 10,
      };

      logger.info(`Circuit Breaker initialized: ${this.config.name}`, {
        config: this.config,
      });
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        // Check if circuit is OPEN
        if (this.state === "OPEN") {
          if (Date.now() < this.nextAttemptTime) {
            // Circuit is still OPEN, reject immediately
            throw new CircuitBreakerOpenError(
              this.config.name,
              this.nextAttemptTime
            );
          } else {
            // Timeout expired, transition to HALF_OPEN
            this.transitionTo("HALF_OPEN");
          }
        }
  
        this.totalRequests++;
  
        try {
          // Execute the function
          const result = await fn();
  
          // Success - handle based on state
          this.onSuccess();
  
          return result;
        } catch (error) {
          // Failure - handle based on state
          this.onFailure(error);
  
          // Re-throw the original error
          throw error;
        }
      }
  
      /**
       * Handle successful request
       */
      private onSuccess(): void {
        this.totalSuccesses++;
        this.failureCount = 0; // Reset consecutive failures
  
        if (this.state === "HALF_OPEN") {
          this.successCount++;
  
          logger.info(
            `Circuit Breaker ${this.config.name}: Success in HALF_OPEN 
    (${this.successCount}/${this.config.successThreshold})`,
            { state: this.state }
          );
  
          // Check if we have enough successes to close
          if (this.successCount >= this.config.successThreshold) {
            this.transitionTo("CLOSED");
          }
        }
      }
  
      /**
       * Handle failed request
       */
      private onFailure(error: unknown): void {
        this.totalFailures++;
        this.failureCount++;
  
        logger.warn(
          `Circuit Breaker ${this.config.name}: Request failed 
    (${this.failureCount}/${this.config.failureThreshold})`,
          {
            state: this.state,
            error: error instanceof Error ? error.message : String(error),
          }
        );
  
        if (this.state === "HALF_OPEN") {
          // Any failure in HALF_OPEN immediately opens the circuit
          logger.error(
            `Circuit Breaker ${this.config.name}: Failed in HALF_OPEN, reopening 
    circuit`,
            { error }
          );
          this.transitionTo("OPEN");
          return;
        }
  
        if (this.state === "CLOSED") {
          // Check if we should open the circuit
          if (this.shouldOpen()) {
            this.transitionTo("OPEN");
          }
        }
      }
  

      private shouldOpen(): boolean {
        if (this.failureCount >= this.config.failureThreshold) {
          return true;
        }
  
        if (this.totalRequests >= this.config.minimumRequests) {
          const failureRate = this.totalFailures / this.totalRequests;
          if (failureRate >= this.config.failureRateThreshold) {
            return true;
          }
        }
  
        return false;
      }
  
  
      private transitionTo(newState: CircuitState): void {
        const oldState = this.state;
        this.state = newState;
        this.lastStateChange = Date.now();
  
        logger.warn(
          `Circuit Breaker ${this.config.name}: State transition ${oldState} → 
    ${newState}`,
          {
            oldState,
            newState,
            metrics: this.getMetrics(),
          }
        );
  
        switch (newState) {
          case "OPEN":
            this.successCount = 0;
            this.nextAttemptTime = Date.now() + this.config.timeout;
            logger.error(
              `Circuit Breaker ${this.config.name}: Circuit OPENED - blocking 
    requests for ${this.config.timeout}ms`,
              {
                nextAttemptTime: new Date(this.nextAttemptTime).toISOString(),
              }
            );
            break;
  
          case "HALF_OPEN":
            this.successCount = 0;
            this.failureCount = 0;
            logger.info(
              `Circuit Breaker ${this.config.name}: Entering HALF_OPEN - testing 
    service recovery`
            );
            break;
  
          case "CLOSED":
            this.successCount = 0;
            this.failureCount = 0;
            this.nextAttemptTime = 0;
            logger.info(
              `Circuit Breaker ${this.config.name}: Circuit CLOSED - normal 
    operation resumed`
            );
            break;
        }
      }
  
      getState(): CircuitState {
        return this.state;
      }
  
      /**
       * Get current metrics
       */
      getMetrics(): CircuitBreakerMetrics {
        return {
          state: this.state,
          totalRequests: this.totalRequests,
          totalFailures: this.totalFailures,
          totalSuccesses: this.totalSuccesses,
          consecutiveFailures: this.failureCount,
          consecutiveSuccesses: this.successCount,
          failureRate:
            this.totalRequests > 0
              ? this.totalFailures / this.totalRequests
              : 0,
          lastStateChange: this.lastStateChange,
          nextAttemptTime: this.nextAttemptTime > 0 ? this.nextAttemptTime : null,
        };
      }
  
      reset(): void {
        logger.warn(`Circuit Breaker ${this.config.name}: Manual reset triggered`);
        this.state = "CLOSED";
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttemptTime = 0;
        this.totalRequests = 0;
        this.totalFailures = 0;
        this.totalSuccesses = 0;
        this.lastStateChange = Date.now();
      }
  
      
      forceOpen(): void {
        logger.error(
          `Circuit Breaker ${this.config.name}: Manually forced to OPEN state`
        );
        this.transitionTo("OPEN");
      }
  
   
      forceClosed(): void {
        logger.warn(
          `Circuit Breaker ${this.config.name}: Manually forced to CLOSED state`
        );
        this.transitionTo("CLOSED");
      }
  
     
      isHealthy(): boolean {
        return this.state === "CLOSED";
      }
    }