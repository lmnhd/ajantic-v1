import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ConsultationRound, RecommendedImplementationType } from '@/src/app/api/playground/analyze-implementation-strategy/_types'; // Adjust path as per your project

export interface ImplementationStrategyAnalysisCardProps { // Exporting the interface
  consultationRound: ConsultationRound | null;
  strategyError: string | null;
  isAnalyzing: boolean;
  modificationRequests: string[];
  onModificationChange: (index: number, value: string) => void;
  onAddModification: () => void;
  onRemoveModification: (index: number) => void;
  onRefineStrategy: () => void;
  onAcceptOrPopulate: () => void; // Combined handler
  acceptButtonText?: string; // Optional: To customize the button text
  refineButtonText?: string; // Optional: To customize the refine button text
  cardClassName?: string;
  title?: string;
  description?: string;
  isAccepted?: boolean; // To conditionally disable or change the accept button
  // New props for exampleTargetPageUrl
  exampleTargetPageUrl?: string;
  onExampleTargetPageUrlChange?: (url: string) => void;
}

const ImplementationStrategyAnalysisCard: React.FC<ImplementationStrategyAnalysisCardProps> = ({
  consultationRound,
  strategyError,
  isAnalyzing,
  modificationRequests,
  onModificationChange,
  onAddModification,
  onRemoveModification,
  onRefineStrategy,
  onAcceptOrPopulate,
  acceptButtonText = "Accept Strategy & Proceed", // Default text
  refineButtonText = "Refine Strategy", // Default text
  cardClassName = "bg-yellow-900/30 border-yellow-700",
  title = "Implementation Strategy Analysis",
  description = "Review the analysis below. You can refine the strategy or accept it.",
  isAccepted = false,
  exampleTargetPageUrl,
  onExampleTargetPageUrlChange,
}) => {
  if (!consultationRound) {
    // Optionally, render a loading state or null if no round data is available yet
    // For now, returning null or a placeholder if there's no active consultation round for this card
    return null;
  }

  const currentRound = consultationRound; // Use the prop directly

  return (
    <Card className={`${cardClassName} border mt-6`}>
      <CardHeader>
        <CardTitle className="text-yellow-300">{title} (Round {currentRound.round})</CardTitle>
        <CardDescription className="text-yellow-400/80">{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-yellow-200 text-sm space-y-4">
        <div>
          <h4 className="font-semibold mb-1 text-yellow-300">Analysis & Verification:</h4>
          <p><strong>Recommendation:</strong> {currentRound.analysis.recommendedType}</p>
          <p><strong>Details:</strong> <span className="font-mono text-xs bg-slate-800/50 px-1 py-0.5 rounded">{currentRound.analysis.strategyDetails}</span></p>
          {currentRound.analysis.requiredCredentialName && <p><strong>Requires Credential:</strong> <span className="font-semibold text-orange-300">{currentRound.analysis.requiredCredentialName}</span></p>}
          {/* Display exampleTargetPageUrl if present in the analysis data itself (e.g. from LLM) */}
          {currentRound.analysis.exampleTargetPageUrl && (
            <p><strong>Hint URL (from analysis):</strong> <span className="font-mono text-xs text-purple-300">{currentRound.analysis.exampleTargetPageUrl}</span></p>
          )}
          {currentRound.analysis.warnings && currentRound.analysis.warnings.length > 0 && <p><strong>Warnings:</strong> <span className="text-orange-300">{currentRound.analysis.warnings.join('; ')}</span></p>}
          <Separator className="bg-yellow-700 my-2" />
          {/* Ensure verification object exists before accessing its properties */}
          {currentRound.verification && (
            <p><strong>Verification:</strong> <span className={currentRound.verification.status === 'success' ? 'text-green-400' : currentRound.verification.status === 'failure' ? 'text-red-400' : 'text-slate-400'}>{currentRound.verification.status}</span> - {currentRound.verification.details}</p>
          )}
        </div>

        {/* Input for exampleTargetPageUrl if strategy is scraping and not accepted */}
        {currentRound.analysis.recommendedType === RecommendedImplementationType.SCRAPING && !isAccepted && onExampleTargetPageUrlChange && (
          <div className="mt-3 mb-3 space-y-1 pt-2 border-t border-yellow-800/50">
            <Label htmlFor="exampleTargetPageUrlFromUser" className="text-xs font-medium text-yellow-300 block pt-2">
              Example Target Page URL (Optional Hint for Scraping)
            </Label>
            <Input
              id="exampleTargetPageUrlFromUser"
              type="url"
              value={exampleTargetPageUrl || ''}
              onChange={(e) => onExampleTargetPageUrlChange(e.target.value)}
              placeholder="https://site.com/path/to/data-page-after-login"
              className="bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-400 text-xs"
              disabled={isAnalyzing}
            />
            <p className="text-xs text-yellow-400/70">
              If data is on a page requiring login/navigation, paste the full URL. Helps immensely.
            </p>
          </div>
        )}

        <Separator className="bg-yellow-700 my-2" />

        {/* Strategy Modification Input Area */}
        <div>
          <Label className="font-semibold text-yellow-300 block mb-2">Refinement Requests (Optional)</Label>
          <div className="space-y-2">
            {modificationRequests.map((mod, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="text"
                  value={mod}
                  onChange={(e) => onModificationChange(index, e.target.value)}
                  placeholder={`e.g., Prefer API endpoint over function`}
                  className="flex-grow bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-400"
                  disabled={isAnalyzing}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveModification(index)}
                  disabled={isAnalyzing}
                  className="h-8 w-8 p-0 text-yellow-400 hover:text-red-400 hover:bg-slate-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  <span className="sr-only">Remove</span>
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={onAddModification}
              disabled={isAnalyzing}
              className="text-xs border-yellow-800 bg-slate-800 text-yellow-300 hover:bg-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M12 5v14M5 12h14" /></svg>
              Add Refinement Request
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3 items-start border-t border-yellow-800 pt-4">
        {/* "Refine Strategy" Button */}
        <Button
          variant="outline"
          onClick={onRefineStrategy}
          disabled={isAnalyzing || modificationRequests.length === 0 || modificationRequests.every(s => s.trim() === '')}
          className="border-yellow-700 text-yellow-300 hover:bg-slate-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M12 20v-6M6 20v-10M18 20v-4M12 14l-4-4 4-4M6 10l-4 4 4 4M18 16l4-4-4-4" /></svg>
          {isAnalyzing && (modificationRequests.length > 0 && !modificationRequests.every(s => s.trim() === '')) ? 'Refining...' : refineButtonText}
        </Button>

        {/* "Accept Strategy & Proceed" / Primary Action Button */}
        {!isAccepted && (
            <Button
                onClick={onAcceptOrPopulate}
                disabled={isAnalyzing} // Disable while analyzing or if already accepted implicitly by isAccepted prop
                className="bg-green-700 hover:bg-green-800 text-white"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M20 6 9 17l-5-5" /></svg>
                {acceptButtonText}
            </Button>
        )}
        {isAccepted && (
             <div className="text-green-400 text-sm p-2 rounded bg-green-900/30 border border-green-700">
                Strategy Accepted!
            </div>
        )}

        {strategyError && <div className="text-red-400 w-full mt-2 text-xs p-2 border border-red-800 bg-red-900/30 rounded">{strategyError}</div>}
      </CardFooter>
    </Card>
  );
};

export default ImplementationStrategyAnalysisCard;
