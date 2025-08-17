import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { QueryProvider } from './providers/QueryProvider';
import { useGenerationWithPolling, useSuggestions } from './hooks/useGenerationQueries';
import { useSelection } from './hooks/useSelection';
import { PaginationBar } from './PaginationBar';
import type { UUID, AIGenerationDTO, AISuggestionDTO, AISuggestionStatus } from '../types';

// Simple StatusBanner matching the clean design
const StatusBanner = ({ status, error }: { status: string; error?: Record<string, unknown> | null }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'succeeded':
        return { 
          color: 'text-green-600', 
          label: 'Zakończone sukcesem'
        };
      case 'running':
        return { 
          color: 'text-blue-600', 
          label: 'W trakcie generowania...'
        };
      case 'pending':
        return { 
          color: 'text-yellow-600', 
          label: 'Oczekuje na start'
        };
      case 'failed':
        return { 
          color: 'text-red-600', 
          label: 'Generacja nie powiodła się'
        };
      default:
        return { 
          color: 'text-gray-600', 
          label: status
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`font-medium ${config.color}`}>Status</h3>
          <p className="text-sm text-gray-600 mt-1">{config.label}</p>
          {error && (
            <p className="text-sm text-red-600 mt-1">
              {typeof error === 'object' && error.message ? error.message : JSON.stringify(error)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const GenerationMetaPanel = ({ generation }: { generation: AIGenerationDTO }) => (
  <div className="mb-8 p-6 bg-white border border-gray-200 rounded-lg">
    <h2 className="text-lg font-semibold text-gray-900 mb-4">Metadane generacji</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div>
        <div className="text-sm font-medium text-gray-500 mb-1">Model AI</div>
        <div className="text-sm text-gray-900 font-mono bg-gray-50 px-3 py-2 rounded border">
          {generation.model}
        </div>
      </div>
      <div>
        <div className="text-sm font-medium text-gray-500 mb-1">Wersja promptu</div>
        <div className="text-sm text-gray-900 font-mono bg-gray-50 px-3 py-2 rounded border">
          {generation.prompt_version}
        </div>
      </div>
      <div>
        <div className="text-sm font-medium text-gray-500 mb-1">Tokeny wejściowe</div>
        <div className="text-sm text-gray-900">{generation.tokens_input?.toLocaleString() || 'N/A'}</div>
      </div>
      <div>
        <div className="text-sm font-medium text-gray-500 mb-1">Tokeny wyjściowe</div>
        <div className="text-sm text-gray-900">{generation.tokens_output?.toLocaleString() || 'N/A'}</div>
      </div>
      <div>
        <div className="text-sm font-medium text-gray-500 mb-1">Koszt USD</div>
        <div className="text-sm text-green-600 font-semibold">
          ${generation.cost_usd?.toFixed(4) || '0.0000'}
        </div>
      </div>
      <div>
        <div className="text-sm font-medium text-gray-500 mb-1">Data utworzenia</div>
        <div className="text-sm text-gray-900">{new Date(generation.created_at).toLocaleString('pl-PL')}</div>
      </div>
    </div>
    {generation.source_text && (
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="text-sm font-medium text-gray-500 mb-2">Tekst źródłowy</div>
        <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded border max-h-24 overflow-y-auto">
          {generation.source_text}
        </div>
      </div>
    )}
  </div>
);

const SuggestionsToolbar = ({ 
  statusFilter, 
  onChangeFilter, 
  selectedCount,
  onAcceptSelected,
  onRejectSelected 
}: {
  statusFilter: AISuggestionStatus | 'all';
  onChangeFilter: (filter: AISuggestionStatus | 'all') => void;
  selectedCount: number;
  onAcceptSelected: () => void;
  onRejectSelected: () => void;
}) => (
  <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
    <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
            Filtruj według statusu:
          </label>
          <Select value={statusFilter} onValueChange={onChangeFilter}>
            <SelectTrigger className="w-48 h-9 border-gray-300" id="status-filter">
              <SelectValue placeholder="Wybierz status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              <SelectItem value="proposed">Zaproponowane</SelectItem>
              <SelectItem value="edited">Edytowane</SelectItem>
              <SelectItem value="accepted">Zaakceptowane</SelectItem>
              <SelectItem value="rejected">Odrzucone</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {selectedCount > 0 && (
          <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
            <span className="text-sm font-medium">
              {selectedCount} zaznaczonych
            </span>
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <Button 
          onClick={onAcceptSelected}
          disabled={selectedCount === 0}
          variant="default"
          size="sm"
          className="h-9 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300"
        >
          Akceptuj zaznaczone
          {selectedCount > 0 && ` (${selectedCount})`}
        </Button>
        <Button 
          onClick={onRejectSelected}
          disabled={selectedCount === 0}
          variant="outline"
          size="sm"
          className="h-9 border-gray-300 text-gray-700 hover:bg-gray-50 disabled:text-gray-400"
        >
          Odrzuć zaznaczone
          {selectedCount > 0 && ` (${selectedCount})`}
        </Button>
      </div>
    </div>
  </div>
);

const SuggestionsList = ({ 
  suggestions, 
  loading,
  selectedIds,
  onToggleSelect
}: { 
  suggestions: AISuggestionDTO[]; 
  loading: boolean;
  selectedIds: Set<UUID>;
  onToggleSelect: (id: UUID) => void;
}) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-5 w-5 mt-2" />
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-6 w-20" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <CardContent>
          <p className="text-muted-foreground">Brak sugestii do wyświetlenia.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {suggestions.map((suggestion, index) => (
        <div key={suggestion.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-6">
            {/* Header with checkbox, title and actions */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Checkbox 
                  checked={selectedIds.has(suggestion.id)}
                  onCheckedChange={() => onToggleSelect(suggestion.id)}
                  className="border-gray-300"
                  aria-label={`Zaznacz sugestię ${suggestion.id}`}
                />
                <div>
                  <h3 className="font-medium text-gray-900">
                    Fiszka #{index + 1}
                  </h3>
                  <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${
                    suggestion.status === 'accepted' ? 'bg-green-100 text-green-700' :
                    suggestion.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    suggestion.status === 'edited' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {suggestion.status === 'proposed' ? 'Zaproponowane' :
                     suggestion.status === 'edited' ? 'Edytowane' :
                     suggestion.status === 'accepted' ? 'Zaakceptowane' :
                     'Odrzucone'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="ghost"
                  disabled={suggestion.status === 'accepted'}
                  className="h-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                  Edytuj
                </Button>
                <Button 
                  size="sm" 
                  variant="default"
                  disabled={suggestion.status === 'accepted' || suggestion.status === 'rejected'}
                  className="h-8 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300"
                >
                  Akceptuj
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  disabled={suggestion.status === 'accepted'}
                  className="h-8 border-red-300 text-red-600 hover:bg-red-50 disabled:text-gray-400"
                >
                  Odrzuć
                </Button>
              </div>
            </div>
            
            {/* Form-like content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Przód fiszki <span className="text-red-500">*</span>
                </label>
                <div className="w-full p-3 border border-gray-300 rounded-lg bg-white min-h-[80px] text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  {suggestion.front}
                </div>
                <p className="text-xs text-gray-500 mt-1">Pytanie lub termin do zapamiętania</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tył fiszki <span className="text-red-500">*</span>
                </label>
                <div className="w-full p-3 border border-gray-300 rounded-lg bg-white min-h-[80px] text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  {suggestion.back}
                </div>
                <p className="text-xs text-gray-500 mt-1">Odpowiedź lub definicja</p>
              </div>
            </div>
            
            {suggestion.accepted_at && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Zaakceptowano: {new Date(suggestion.accepted_at).toLocaleDateString('pl-PL')}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

interface GenerationDetailPageProps {
  generationId: UUID;
}

// Internal component that uses queries
function GenerationDetailContent({ generationId }: GenerationDetailPageProps) {
  // State management
  const [statusFilter, setStatusFilter] = useState<AISuggestionStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  
  // Selection management
  const selection = useSelection<UUID>();

  // API queries
  const { 
    data: generation, 
    isLoading: generationLoading, 
    error: generationError 
  } = useGenerationWithPolling(generationId);

  const { 
    data: suggestionsData, 
    isLoading: suggestionsLoading, 
    error: suggestionsError 
  } = useSuggestions(generationId, {
    status: statusFilter === 'all' ? undefined : statusFilter,
    page,
    per_page: perPage,
  });

  const suggestions = suggestionsData?.items || [];
  const loading = generationLoading || suggestionsLoading;
  const error = generationError || suggestionsError;

  // Event handlers - to be implemented in later steps
  const handleAcceptSelected = () => {
    console.log('Accept selected:', selection.getSelectedArray());
    // TODO: Open DeckSelectModal and then call accept-batch API
  };

  const handleRejectSelected = () => {
    console.log('Reject selected:', selection.getSelectedArray());
    // TODO: Call reject-batch API (PUT status=rejected for each)
  };

  const handleDeleteGeneration = () => {
    console.log('Delete generation:', generationId);
    // TODO: Open ConfirmModal and then call DELETE API
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header skeleton */}
          <div className="mb-8">
            <Skeleton className="h-7 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>

          {/* Status banner skeleton */}
          <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
            <div className="space-y-1">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>

          {/* Meta panel skeleton */}
          <div className="mb-8 p-6 bg-white border border-gray-200 rounded-lg">
            <Skeleton className="h-6 w-48 mb-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Suggestions section skeleton */}
          <div className="space-y-6">
            <div>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-80" />
            </div>
            
            {/* Toolbar skeleton */}
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-9 w-48" />
                </div>
                <div className="flex gap-3">
                  <Skeleton className="h-9 w-32" />
                  <Skeleton className="h-9 w-32" />
                </div>
              </div>
            </div>

            {/* Suggestions list skeleton */}
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white border border-gray-200 rounded-lg">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-4 w-4" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-5 w-24" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-8 w-16" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="p-6 bg-white border border-red-200 rounded-lg">
            <h3 className="font-medium text-red-800 mb-2">Błąd</h3>
            <p className="text-red-600 mb-4">{errorMessage}</p>
            <Button 
              onClick={() => window.location.reload()} 
              className="bg-blue-600 hover:bg-blue-700"
            >
              Spróbuj ponownie
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!generation) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="p-6 bg-white border border-gray-200 rounded-lg">
            <p className="text-gray-900 mb-4">Generacja nie została znaleziona.</p>
            <Button 
              onClick={() => window.history.back()}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Wróć
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Simple Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Szczegóły generacji AI
          </h1>
          <p className="text-gray-600 text-sm">
            Generacja #{generationId.slice(0, 8)}
          </p>
        </div>

        {/* Status Banner */}
        <StatusBanner status={generation.status} error={generation.error} />

        {/* Generation Metadata */}
        <GenerationMetaPanel generation={generation} />

        {/* Suggestions Section */}
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Sugestie fiszek
            </h2>
            <p className="text-gray-600 text-sm">
              Wygenerowane przez AI fiszki gotowe do akceptacji lub edycji
            </p>
          </div>
          
          {/* Toolbar */}
          <SuggestionsToolbar
            statusFilter={statusFilter}
            onChangeFilter={setStatusFilter}
            selectedCount={selection.selectionCount}
            onAcceptSelected={handleAcceptSelected}
            onRejectSelected={handleRejectSelected}
          />

          {/* Suggestions List */}
          <SuggestionsList 
            suggestions={suggestions}
            loading={suggestionsLoading}
            selectedIds={selection.selectedIds}
            onToggleSelect={selection.toggle}
          />

          {/* Pagination */}
          {suggestionsData && suggestionsData.total > 0 && (
            <div className="mt-8">
              <PaginationBar
                page={page}
                perPage={perPage}
                total={suggestionsData.total}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Main component with QueryProvider wrapper
export default function GenerationDetailPage({ generationId }: GenerationDetailPageProps) {
  return (
    <QueryProvider>
      <GenerationDetailContent generationId={generationId} />
    </QueryProvider>
  );
}
