import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AutoGenTeam } from '@/src/lib/autogen/autogen';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { Trash2, GripVertical } from 'lucide-react';

interface ProcessStepsTabProps {
  localWorkflow: AutoGenTeam;
  handleClearSteps: () => void;
  handleProcessStepChange: (index: number, value: string) => void;
  handleAddProcessStep: () => void;
  handleRemoveProcessStep: (index: number) => void;
  handleReorderProcessSteps: (sourceIndex: number, destinationIndex: number) => void;
}

const ProcessStepsTab: React.FC<ProcessStepsTabProps> = ({
  localWorkflow,
  handleClearSteps,
  handleProcessStepChange,
  handleAddProcessStep,
  handleRemoveProcessStep,
  handleReorderProcessSteps,
}) => {
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) {
      return;
    }

    handleReorderProcessSteps(sourceIndex, destinationIndex);
  };

  // Prevent text selection during drag
  const preventTextSelection = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Process Steps</h3>
        <div className="space-x-2">
          <Button onClick={handleAddProcessStep} variant="outline" size="sm">
            Add Step
          </Button>
          {localWorkflow.processSteps.length > 0 && (
            <Button onClick={handleClearSteps} variant="destructive" size="sm">
              Clear All
            </Button>
          )}
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="processSteps">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-2"
            >
              {localWorkflow.processSteps.length === 0 ? (
                <div className="text-center p-4 border border-dashed rounded-md text-muted-foreground">
                  No process steps added yet
                </div>
              ) : (
                localWorkflow.processSteps.map((step: string, index: number) => (
                  <Draggable key={`step-${index}`} draggableId={`step-${index}`} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`relative flex items-center bg-card border rounded-md p-2 ${
                          snapshot.isDragging ? 'shadow-lg border-primary' : ''
                        } select-none`}
                        onMouseDown={preventTextSelection}
                      >
                        <div 
                          {...provided.dragHandleProps}
                          className="w-8 h-8 flex items-center justify-center mr-2 cursor-grab active:cursor-grabbing hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title="Drag to reorder"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="w-6 h-6 flex items-center justify-center mr-2 rounded bg-muted text-sm">
                          {index + 1}
                        </div>
                        <Input
                          value={step}
                          onChange={(e) => handleProcessStepChange(index, e.target.value)}
                          placeholder={`Step ${index + 1}`}
                          className="flex-1"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveProcessStep(index)}
                          className="ml-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </Draggable>
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default ProcessStepsTab; 