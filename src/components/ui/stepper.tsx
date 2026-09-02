import {
  Children,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

import "./stepper.css";

export interface StepperIndicatorRenderArgs {
  step: number;
  currentStep: number;
  onStepClick: (step: number) => void;
}

export interface StepperProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
  initialStep?: number;
  currentStep?: number;
  onStepChange?: (step: number) => void;
  onBeforeStepChange?: (currentStep: number, nextStep: number) => boolean | Promise<boolean>;
  onFinalStepCompleted?: () => void;
  stepCircleContainerClassName?: string;
  stepContainerClassName?: string;
  scrollActiveIndicatorIntoView?: boolean;
  contentClassName?: string;
  footerClassName?: string;
  backButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  nextButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  backButtonText?: string;
  nextButtonText?: string;
  completeButtonText?: string;
  disableStepIndicators?: boolean;
  renderStepIndicator?: (args: StepperIndicatorRenderArgs) => ReactNode;
  className?: string;
}

export default function Stepper({
  children,
  initialStep = 1,
  currentStep: controlledStep,
  onStepChange = () => {},
  onBeforeStepChange,
  onFinalStepCompleted = () => {},
  stepCircleContainerClassName = "",
  stepContainerClassName = "",
  scrollActiveIndicatorIntoView = false,
  contentClassName = "",
  footerClassName = "",
  backButtonProps = {},
  nextButtonProps = {},
  backButtonText = "Back",
  nextButtonText = "Continue",
  completeButtonText = "Complete",
  disableStepIndicators = false,
  renderStepIndicator,
  className = "",
  ...rest
}: StepperProps) {
  const stepsArray = Children.toArray(children);
  const totalSteps = stepsArray.length;
  const normalizedInitialStep = Math.min(Math.max(initialStep, 1), Math.max(totalSteps, 1));
  const [internalStep, setInternalStep] = useState(normalizedInitialStep);
  const [direction, setDirection] = useState<1 | -1>(1);
  const currentStep = controlledStep ?? internalStep;
  const previousControlledStep = useRef(currentStep);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollActiveIndicatorIntoView) return;
    progressRef.current
      ?.querySelector<HTMLElement>('[aria-current="step"]')
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [currentStep, scrollActiveIndicatorIntoView]);

  useEffect(() => {
    if (controlledStep === undefined || controlledStep === previousControlledStep.current) return;
    setDirection(controlledStep > previousControlledStep.current ? 1 : -1);
    previousControlledStep.current = controlledStep;
  }, [controlledStep]);

  const isCompleted = currentStep > totalSteps;
  const isLastStep = currentStep === totalSteps;

  const updateStep = async (nextStep: number) => {
    if (nextStep > currentStep && onBeforeStepChange) {
      const mayAdvance = await onBeforeStepChange(currentStep, nextStep);
      if (!mayAdvance) return;
    }

    if (nextStep > totalSteps) {
      if (controlledStep === undefined) setInternalStep(nextStep);
      onFinalStepCompleted();
      return;
    }

    if (controlledStep === undefined) setInternalStep(nextStep);
    onStepChange(nextStep);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection(-1);
      void updateStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (!isLastStep) {
      setDirection(1);
      void updateStep(currentStep + 1);
    }
  };

  const handleComplete = () => {
    setDirection(1);
    void updateStep(totalSteps + 1);
  };

  const { className: backButtonClassName, onClick: onBackClick, ...backButtonRest } = backButtonProps;
  const { className: nextButtonClassName, onClick: onNextClick, ...nextButtonRest } = nextButtonProps;

  return (
    <div className={cn("stepper-outer-container", className)} {...rest}>
      <div className={cn("stepper-circle-container", stepCircleContainerClassName)}>
        <div
          ref={progressRef}
          className={cn("stepper-indicator-row", stepContainerClassName)}
          aria-label="Form progress"
        >
          <div className="stepper-indicator-track">
            {stepsArray.map((_, index) => {
              const stepNumber = index + 1;
              const isNotLastStep = index < totalSteps - 1;
              const onStepClick = (clickedStep: number) => {
                if (clickedStep === currentStep || disableStepIndicators) return;
                setDirection(clickedStep > currentStep ? 1 : -1);
                void updateStep(clickedStep);
              };

              return (
                <div key={stepNumber} className="stepper-indicator-group">
                  {renderStepIndicator ? (
                    renderStepIndicator({ step: stepNumber, currentStep, onStepClick })
                  ) : (
                    <StepIndicator
                      step={stepNumber}
                      currentStep={currentStep}
                      disableStepIndicators={disableStepIndicators}
                      onClickStep={onStepClick}
                    />
                  )}
                  {isNotLastStep ? <StepConnector isComplete={currentStep > stepNumber} /> : null}
                </div>
              );
            })}
          </div>
        </div>

        <StepContentWrapper
          isCompleted={isCompleted}
          currentStep={currentStep}
          direction={direction}
          className={cn("stepper-content-default", contentClassName)}
        >
          {stepsArray[currentStep - 1]}
        </StepContentWrapper>

        {!isCompleted ? (
          <div className={cn("stepper-footer-container", footerClassName)}>
            <div className={cn("stepper-footer-nav", currentStep !== 1 ? "stepper-footer-nav--spread" : "stepper-footer-nav--end")}>
              {currentStep !== 1 ? (
                <button
                  {...backButtonRest}
                  type="button"
                  className={cn("stepper-back-button", backButtonClassName)}
                  onClick={(event) => {
                    onBackClick?.(event);
                    if (!event.defaultPrevented) handleBack();
                  }}
                >
                  {backButtonText}
                </button>
              ) : null}
              <button
                {...nextButtonRest}
                type="button"
                className={cn("stepper-next-button", nextButtonClassName)}
                onClick={(event) => {
                  onNextClick?.(event);
                  if (!event.defaultPrevented) {
                    if (isLastStep) handleComplete();
                    else handleNext();
                  }
                }}
              >
                {isLastStep ? completeButtonText : nextButtonText}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StepContentWrapper({
  isCompleted,
  currentStep,
  direction,
  children,
  className,
}: {
  isCompleted: boolean;
  currentStep: number;
  direction: 1 | -1;
  children: ReactNode;
  className?: string;
}) {
  const [parentHeight, setParentHeight] = useState(0);

  return (
    <motion.div
      className={className}
      style={{ position: "relative", overflow: "hidden" }}
      animate={{ height: isCompleted ? 0 : parentHeight }}
      transition={{ type: "spring", duration: 0.4 }}
    >
      <AnimatePresence initial={false} mode="sync" custom={direction}>
        {!isCompleted ? (
          <SlideTransition key={currentStep} direction={direction} onHeightReady={setParentHeight}>
            {children}
          </SlideTransition>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function SlideTransition({
  children,
  direction,
  onHeightReady,
}: {
  children: ReactNode;
  direction: 1 | -1;
  onHeightReady: (height: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateHeight = () => onHeightReady(el.offsetHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children, onHeightReady]);

  return (
    <motion.div
      ref={containerRef}
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.4 }}
      style={{ position: "absolute", left: 0, right: 0, top: 0 }}
    >
      {children}
    </motion.div>
  );
}

export function Step({ children }: { children: ReactNode }) {
  return <div className="stepper-step-default">{children}</div>;
}

function StepIndicator({
  step,
  currentStep,
  onClickStep,
  disableStepIndicators,
}: {
  step: number;
  currentStep: number;
  onClickStep: (step: number) => void;
  disableStepIndicators: boolean;
}) {
  const status = currentStep === step ? "active" : currentStep < step ? "inactive" : "complete";

  return (
    <button
      type="button"
      className="stepper-indicator"
      onClick={() => onClickStep(step)}
      disabled={disableStepIndicators}
      aria-current={status === "active" ? "step" : undefined}
      aria-label={`Go to step ${step}`}
    >
      <motion.span
        className="stepper-indicator-inner"
        variants={{
          inactive: { scale: 1, backgroundColor: "var(--stepper-inactive-bg)", color: "var(--stepper-inactive-fg)" },
          active: { scale: 1.04, backgroundColor: "var(--stepper-active-bg)", color: "var(--stepper-active-fg)" },
          complete: { scale: 1, backgroundColor: "var(--stepper-complete-bg)", color: "var(--stepper-complete-fg)" },
        }}
        transition={{ duration: 0.3 }}
        animate={status}
        initial={false}
      >
        {status === "complete" ? <Check className="stepper-check-icon" /> : status === "active" ? <span className="stepper-active-dot" /> : step}
      </motion.span>
    </button>
  );
}

function StepConnector({ isComplete }: { isComplete: boolean }) {
  return (
    <span className="stepper-connector" aria-hidden="true">
      <motion.span
        className="stepper-connector-inner"
        variants={{
          incomplete: { width: 0, backgroundColor: "transparent" },
          complete: { width: "100%", backgroundColor: "var(--stepper-connector)" },
        }}
        initial={false}
        animate={isComplete ? "complete" : "incomplete"}
        transition={{ duration: 0.4 }}
      />
    </span>
  );
}

const stepVariants = {
  enter: (direction: 1 | -1) => ({ x: direction >= 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: "0%", opacity: 1 },
  exit: (direction: 1 | -1) => ({ x: direction >= 0 ? "-50%" : "50%", opacity: 0 }),
};
