import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    FiAlertCircle,
    FiArrowLeft,
    FiArrowRight,
    FiBookOpen,
    FiCheckCircle,
    FiChevronDown,
    FiChevronRight,
    FiClock,
    FiCpu,
    FiEdit3,
    FiFileText,
    FiHelpCircle,
    FiLayers,
    FiRefreshCw,
    FiSearch,
    FiTarget,
    FiTrash2,
    FiUploadCloud,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axiosInstance';
import Tooltip from '../../components/teacher/Tooltip';

const QUESTION_TYPES = [
    { key: 'single_choice', label: 'MCQ', description: 'One correct answer', supportsOptions: true },
    { key: 'multiple_choice', label: 'Multiple Choice', description: 'Several correct answers', supportsOptions: true },
    { key: 'true_false', label: 'True / False', description: 'Binary validation', supportsOptions: false },
    { key: 'matching', label: 'Matching', description: 'Pair related concepts', supportsOptions: false },
    { key: 'ordering', label: 'Ordering', description: 'Sequence steps or events', supportsOptions: false },
    { key: 'negative_qcm', label: 'Negative QCM', description: 'Pick the incorrect statement', supportsOptions: true },
];

const DIFFICULTY_TIERS = [
    { key: 'easy', label: 'Easy', helper: 'Foundational recall and straightforward understanding' },
    { key: 'medium', label: 'Medium', helper: 'Application-focused questions with moderate reasoning' },
    { key: 'hard', label: 'Hard', helper: 'Analysis-heavy or advanced judgement questions' },
];

const BLOOM_LEVELS = [
    { key: 'recall', label: 'Recall', helper: 'Testing the student\'s ability to retrieve specific facts or definitions.' },
    { key: 'understanding', label: 'Understand', helper: 'Checking whether the student can explain ideas in their own words.' },
    { key: 'application', label: 'Apply', helper: 'Using learned concepts in a new but familiar academic situation.' },
    { key: 'analysis', label: 'Analyze', helper: 'Breaking material into parts and reasoning about relationships or structure.' },
    { key: 'evaluation', label: 'Evaluate', helper: 'Judging approaches, evidence, or choices using academic criteria.' },
    { key: 'create', label: 'Create', helper: 'Producing a new plan, solution, or synthesis from the studied material.' },
];

const WORKFLOW_STEPS = [
    { id: 1, title: 'Upload', icon: FiUploadCloud },
    { id: 2, title: 'Topics', icon: FiBookOpen },
    { id: 3, title: 'Questions', icon: FiLayers },
    { id: 4, title: 'Difficulty', icon: FiTarget },
    { id: 5, title: 'Marks', icon: FiEdit3 },
    { id: 6, title: 'Review', icon: FiFileText },
];

const MATERIAL_PROGRESS = [
    { key: 'uploading', label: 'Uploading' },
    { key: 'parsing', label: 'Parsing' },
    { key: 'embedding', label: 'Processing' },
    { key: 'generating_mindmap', label: 'Mind map generation' },
    { key: 'ready', label: 'Ready' },
];

const MATERIAL_STAGE_INDEX = {
    uploading: 0,
    parsing: 1,
    embedding: 2,
    generating_mindmap: 3,
    ready: 4,
};

const PROCESSING_STATUSES = ['uploading', 'parsing', 'embedding', 'generating_mindmap'];
const READY_STATUS = 'ready';
const FAILED_STATUSES = ['failed', 'error'];
const QUESTION_LIMIT = 100;

const createQuestionTypes = () => Object.fromEntries(
    QUESTION_TYPES.map((type) => [
        type.key,
        {
            count: 0,
            options: 4,
        },
    ])
);

const createDifficultyMatrix = () => Object.fromEntries(
    DIFFICULTY_TIERS.map((tier) => [
        tier.key,
        Object.fromEntries(BLOOM_LEVELS.map((level) => [level.key, 0])),
    ])
);

const createMarksConfig = () => ({
    mode: 'question',
    defaultRule: {
        reward: 1,
        penalty: -0.5,
        unanswered: 0,
    },
    perType: Object.fromEntries(
        QUESTION_TYPES.map((type) => [
            type.key,
            {
                reward: 1,
                penalty: -0.5,
                unanswered: 0,
            },
        ])
    ),
});

const createWorkflowDraft = () => ({
    currentStep: 1,
    selectedMaterialIds: [],
    selectedTopics: {},
    mindmapProviderConfigId: '',
    examProviderConfigId: '',
    questionTypes: createQuestionTypes(),
    difficultyMatrix: createDifficultyMatrix(),
    marks: createMarksConfig(),
    instructions: '',
    uploadedInSessionIds: [],
});

const getDraftStorageKey = (moduleId) => `teacher-exam-workflow:${moduleId}`;

const loadStoredDraft = (moduleId) => {
    if (!moduleId) return createWorkflowDraft();

    try {
        const rawValue = window.sessionStorage.getItem(getDraftStorageKey(moduleId));
        if (!rawValue) return createWorkflowDraft();
        const parsed = JSON.parse(rawValue);
        return {
            ...createWorkflowDraft(),
            ...parsed,
            questionTypes: { ...createQuestionTypes(), ...(parsed.questionTypes || {}) },
            difficultyMatrix: Object.fromEntries(
                DIFFICULTY_TIERS.map((tier) => [
                    tier.key,
                    {
                        ...createDifficultyMatrix()[tier.key],
                        ...(parsed.difficultyMatrix?.[tier.key] || {}),
                    },
                ])
            ),
            marks: {
                ...createMarksConfig(),
                ...(parsed.marks || {}),
                defaultRule: {
                    ...createMarksConfig().defaultRule,
                    ...(parsed.marks?.defaultRule || {}),
                },
                perType: {
                    ...createMarksConfig().perType,
                    ...(parsed.marks?.perType || {}),
                },
            },
            selectedTopics: parsed.selectedTopics || {},
            mindmapProviderConfigId: parsed.mindmapProviderConfigId || '',
            examProviderConfigId: parsed.examProviderConfigId || '',
            selectedMaterialIds: parsed.selectedMaterialIds || [],
            uploadedInSessionIds: parsed.uploadedInSessionIds || [],
        };
    } catch {
        return createWorkflowDraft();
    }
};

const formatStatusLabel = (status) => {
    if (status === 'generating_mindmap') return 'Mind map generation';
    if (status === 'ready') return 'Ready';
    if (status === 'embedding') return 'Processing';
    if (status === 'failed' || status === 'error') return 'Failed';
    if (!status) return 'Pending';
    return status.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
};

const clampNonNegativeInteger = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
};

const clampNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const sumObjectValues = (value = {}) => Object.values(value).reduce((sum, count) => sum + clampNonNegativeInteger(count), 0);

const buildAcademicDifficultyDistribution = (difficultyMatrix) => Object.fromEntries(
    DIFFICULTY_TIERS.map((tier) => [tier.key, sumObjectValues(difficultyMatrix?.[tier.key])])
);

const buildCognitiveDistribution = (difficultyMatrix) => Object.fromEntries(
    BLOOM_LEVELS.map((level) => [
        level.key,
        DIFFICULTY_TIERS.reduce(
            (sum, tier) => sum + clampNonNegativeInteger(difficultyMatrix?.[tier.key]?.[level.key]),
            0
        ),
    ])
);

const buildQuestionProfiles = (difficultyMatrix) => DIFFICULTY_TIERS.flatMap((tier) => (
    BLOOM_LEVELS
        .map((level) => ({
            difficulty: tier.key,
            cognitiveLevel: level.key,
            count: clampNonNegativeInteger(difficultyMatrix?.[tier.key]?.[level.key]),
        }))
        .filter((profile) => profile.count > 0)
));

const getSelectedTopicLabels = (selectedTopics) => [...new Set(Object.values(selectedTopics || {}))];

const buildBlueprintScoringPayload = (questionTypes, marks) => {
    const activeQuestionTypeKeys = QUESTION_TYPES
        .filter((type) => Number(questionTypes[type.key]?.count || 0) > 0)
        .map((type) => type.key);

    const defaultRule = {
        reward: clampNumber(marks.defaultRule.reward, 1),
        penalty: clampNumber(marks.defaultRule.penalty, -0.5),
        unanswered: clampNumber(marks.defaultRule.unanswered, 0),
    };

    if (marks.mode === 'section') {
        const perType = Object.fromEntries(
            activeQuestionTypeKeys.map((questionTypeKey) => [
                questionTypeKey,
                {
                    reward: clampNumber(marks.perType[questionTypeKey]?.reward, defaultRule.reward),
                    penalty: clampNumber(marks.perType[questionTypeKey]?.penalty, defaultRule.penalty),
                    unanswered: clampNumber(marks.perType[questionTypeKey]?.unanswered, defaultRule.unanswered),
                },
            ])
        );

        return {
            scoringRules: Object.fromEntries(
                Object.entries(perType).map(([questionTypeKey, rule]) => [
                    questionTypeKey,
                    {
                        reward: rule.reward,
                        penalty: rule.penalty,
                        unanswered: rule.unanswered,
                    },
                ])
            ),
            scoringConfig: {
                mode: 'section',
                defaultRule,
                perType,
            },
        };
    }

    return {
        scoringRules: Object.fromEntries(
            activeQuestionTypeKeys.map((questionTypeKey) => [
                questionTypeKey,
                {
                    reward: defaultRule.reward,
                    penalty: defaultRule.penalty,
                    unanswered: defaultRule.unanswered,
                },
            ])
        ),
        scoringConfig: {
            mode: 'question',
            defaultRule,
            perType: {},
        },
    };
};

const getCurrentStepMeta = (stepId) => WORKFLOW_STEPS.find((step) => step.id === stepId) || WORKFLOW_STEPS[0];

const StepShell = ({ eyebrow, title, subtitle, children }) => (
    <section className="surface-card p-6 md:p-8">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-5">
            <p className="eyebrow !text-slate-400">{eyebrow}</p>
            <h2 className="text-2xl font-extrabold text-slate-900">{title}</h2>
            <p className="max-w-3xl text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="mt-6 space-y-6">{children}</div>
    </section>
);

const WorkflowStepper = ({ currentStep }) => (
    <div className="sticky-under-shell-topbar surface-card p-5">
        <div className="grid gap-3 md:grid-cols-6">
            {WORKFLOW_STEPS.map((step) => {
                const Icon = step.icon;
                const isActive = currentStep === step.id;
                const isComplete = currentStep > step.id;

                return (
                    <div
                        key={step.id}
                        className={`rounded-[24px] border px-4 py-4 transition ${
                            isActive
                                ? 'border-cyan-300 bg-cyan-50 text-cyan-800'
                                : isComplete
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 bg-slate-50 text-slate-500'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                                isActive
                                    ? 'bg-cyan-600 text-white'
                                    : isComplete
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-white text-slate-400'
                            }`}>
                                <Icon className="text-lg" />
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.18em]">Step {step.id}</p>
                                <p className="mt-1 text-sm font-bold">{step.title}</p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

const WorkflowActionBar = ({ stepLabel, backLabel, nextLabel, onBack, onNext, nextDisabled, loading = false, summary }) => (
    <div className="sticky top-0 z-10 rounded-[28px] border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{stepLabel}</p>
                <p className="mt-1 text-sm text-slate-600">{summary}</p>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button type="button" onClick={onBack} className="ghost-button" disabled={!onBack}>
                    <FiArrowLeft />
                    <span>{backLabel}</span>
                </button>
                <button type="button" onClick={onNext} disabled={nextDisabled || loading} className="secondary-button">
                    <span>{loading ? 'Working...' : nextLabel}</span>
                    <FiArrowRight />
                </button>
            </div>
        </div>
    </div>
);

const TopicTree = ({ materialId, node, path = [], selectedTopics, onToggle }) => {
    const nodePath = [...path, node.name];
    const nodeKey = `${materialId}:${nodePath.join('>')}`;
    const isChecked = Boolean(selectedTopics[nodeKey]);
    const hasChildren = Boolean(node.children?.length);
    const [expanded, setExpanded] = useState(path.length < 1);

    return (
        <div className="space-y-2" style={{ marginLeft: path.length * 18 }}>
            <div className="flex items-center gap-2 rounded-2xl px-3 py-2 hover:bg-slate-50">
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={() => setExpanded((current) => !current)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                        aria-label={expanded ? 'Collapse topic' : 'Expand topic'}
                    >
                        {expanded ? <FiChevronDown /> : <FiChevronRight />}
                    </button>
                ) : (
                    <span className="flex h-7 w-7 items-center justify-center text-slate-300">-</span>
                )}
                <label className="flex flex-1 items-center gap-3">
                    <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(event) => onToggle(materialId, node, nodePath, event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <span className="text-sm font-medium text-slate-700">{node.name}</span>
                </label>
            </div>
            {hasChildren && expanded ? (node.children || []).map((child, index) => (
                <TopicTree
                    key={`${materialId}-${child.name}-${index}`}
                    materialId={materialId}
                    node={child}
                    path={nodePath}
                    selectedTopics={selectedTopics}
                    onToggle={onToggle}
                />
            )) : null}
        </div>
    );
};

const ExamLlmPicker = ({
    providers,
    selectedProviderId,
    selectedProvider,
    loading,
    onChange,
}) => (
    <section className="surface-card border-cyan-200 bg-cyan-50/70 p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.1fr,1fr] lg:items-center">
            <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-600 text-xl text-white">
                    <FiCpu />
                </div>
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">Exam generation LLM</p>
                    <h2 className="mt-1 text-xl font-extrabold text-slate-950">Choose the model before generating</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                        This provider is used for the final draft generation step and is saved into the blueprint.
                    </p>
                </div>
            </div>

            <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                    <span>LLM for generated exam draft</span>
                    <Tooltip text="The selected provider turns the blueprint, selected topics, retrieved material, and marking rules into the draft exam JSON.">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] text-slate-700">
                            <FiHelpCircle />
                        </span>
                    </Tooltip>
                </label>
                <select
                    className="select-field border-cyan-200 bg-white font-semibold text-slate-900 shadow-sm"
                    value={selectedProviderId}
                    onChange={(event) => onChange(event.target.value)}
                    disabled={loading}
                >
                    <option value="">System default</option>
                    {providers.map((provider) => (
                        <option key={`top-exam-${provider.id}`} value={provider.id}>
                            {provider.label} | {provider.model_name}
                        </option>
                    ))}
                </select>
                <p className="mt-2 text-sm font-medium text-slate-600">
                    {selectedProvider
                        ? `${selectedProvider.description || 'Selected for exam generation.'}${selectedProvider.base_url ? ` Host: ${selectedProvider.base_url}` : ''}`
                        : 'If no provider is selected, the server falls back to the system default LLM configuration.'}
                </p>
            </div>
        </div>
    </section>
);

const TeacherExamWorkflow = () => {
    const { moduleId } = useParams();
    const navigate = useNavigate();
    const [modules, setModules] = useState([]);
    const [workflow, setWorkflow] = useState(null);
    const [aiOptions, setAiOptions] = useState({ llmProviders: [], defaultLlmProviderId: null, embeddingProvider: null });
    const [draft, setDraft] = useState(createWorkflowDraft);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadTitle, setUploadTitle] = useState('');
    const [materialSearchQuery, setMaterialSearchQuery] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [loadingWorkflow, setLoadingWorkflow] = useState(false);
    const [loadingAiOptions, setLoadingAiOptions] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [retryingMaterialId, setRetryingMaterialId] = useState('');
    const [deletingMaterialId, setDeletingMaterialId] = useState('');

    useEffect(() => {
        axiosInstance.get('/teacher/modules').then((response) => setModules(response.data)).catch(() => {});
    }, []);

    useEffect(() => {
        let active = true;

        const loadAiOptions = async () => {
            setLoadingAiOptions(true);
            try {
                const response = await axiosInstance.get('/teacher/ai-options');
                if (!active) return;
                setAiOptions(response.data);
            } catch (error) {
                if (!active) return;
                setStatusMessage(error.response?.data?.message || 'Failed to load the AI provider catalog.');
            } finally {
                if (active) {
                    setLoadingAiOptions(false);
                }
            }
        };

        loadAiOptions().catch(() => {});
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!moduleId) return;
        setDraft(loadStoredDraft(moduleId));
    }, [moduleId]);

    useEffect(() => {
        if (!moduleId) return;
        window.sessionStorage.setItem(getDraftStorageKey(moduleId), JSON.stringify(draft));
    }, [draft, moduleId]);

    useEffect(() => {
        const availableIds = new Set(aiOptions.llmProviders.map((provider) => String(provider.id)));
        const fallbackId = aiOptions.defaultLlmProviderId ? String(aiOptions.defaultLlmProviderId) : '';

        setDraft((current) => {
            const currentMindmapId = current.mindmapProviderConfigId ? String(current.mindmapProviderConfigId) : '';
            const currentExamId = current.examProviderConfigId ? String(current.examProviderConfigId) : '';
            const nextMindmapProviderConfigId = currentMindmapId && availableIds.has(currentMindmapId) ? currentMindmapId : fallbackId;
            const nextExamProviderConfigId = currentExamId && availableIds.has(currentExamId) ? currentExamId : fallbackId;

            if (
                nextMindmapProviderConfigId === currentMindmapId
                && nextExamProviderConfigId === currentExamId
            ) {
                return current;
            }

            return {
                ...current,
                mindmapProviderConfigId: nextMindmapProviderConfigId,
                examProviderConfigId: nextExamProviderConfigId,
            };
        });
    }, [aiOptions.defaultLlmProviderId, aiOptions.llmProviders]);

    const loadWorkflow = async () => {
        if (!moduleId) return;
        setLoadingWorkflow(true);
        try {
            const response = await axiosInstance.get(`/teacher/modules/${moduleId}/workflow`);
            setWorkflow(response.data);
        } catch (error) {
            setStatusMessage(error.response?.data?.message || 'Failed to load the exam workflow.');
        } finally {
            setLoadingWorkflow(false);
        }
    };

    useEffect(() => {
        loadWorkflow().catch(() => {});
    }, [moduleId]);

    useEffect(() => {
        if (!workflow) return;
        if (!workflow.materials.some((material) => PROCESSING_STATUSES.includes(material.status))) return;

        const interval = window.setInterval(() => {
            loadWorkflow().catch(() => {});
        }, 3000);
        return () => window.clearInterval(interval);
    }, [workflow, moduleId]);

    useEffect(() => {
        if (!workflow) return;

        const availableMaterialIds = new Set(workflow.materials.map((material) => material._id));
        setDraft((current) => {
            const nextSelectedMaterialIds = current.selectedMaterialIds.filter((materialId) => availableMaterialIds.has(materialId));
            const nextSelectedTopics = Object.fromEntries(
                Object.entries(current.selectedTopics).filter(([topicKey]) => availableMaterialIds.has(topicKey.split(':')[0]))
            );
            const nextUploadedIds = current.uploadedInSessionIds.filter((materialId) => availableMaterialIds.has(materialId));

            if (
                nextSelectedMaterialIds.length === current.selectedMaterialIds.length
                && Object.keys(nextSelectedTopics).length === Object.keys(current.selectedTopics).length
                && nextUploadedIds.length === current.uploadedInSessionIds.length
            ) {
                return current;
            }

            return {
                ...current,
                selectedMaterialIds: nextSelectedMaterialIds,
                selectedTopics: nextSelectedTopics,
                uploadedInSessionIds: nextUploadedIds,
            };
        });
    }, [workflow]);

    const moduleReadyMaterials = useMemo(
        () => workflow?.materials.filter((material) => material.status === READY_STATUS) || [],
        [workflow]
    );

    const selectedMaterials = useMemo(
        () => moduleReadyMaterials.filter((material) => draft.selectedMaterialIds.includes(material._id)),
        [draft.selectedMaterialIds, moduleReadyMaterials]
    );

    const selectedMindmapProvider = useMemo(
        () => aiOptions.llmProviders.find((provider) => String(provider.id) === String(draft.mindmapProviderConfigId)) || null,
        [aiOptions.llmProviders, draft.mindmapProviderConfigId]
    );

    const selectedExamProvider = useMemo(
        () => aiOptions.llmProviders.find((provider) => String(provider.id) === String(draft.examProviderConfigId)) || null,
        [aiOptions.llmProviders, draft.examProviderConfigId]
    );

    const filteredReadyMaterials = useMemo(() => {
        const query = materialSearchQuery.trim().toLowerCase();
        if (!query) return moduleReadyMaterials;
        return moduleReadyMaterials.filter((material) => (
            `${material.title} ${material.filename || ''}`.toLowerCase().includes(query)
        ));
    }, [materialSearchQuery, moduleReadyMaterials]);

    const selectedTopicLabels = useMemo(
        () => getSelectedTopicLabels(draft.selectedTopics),
        [draft.selectedTopics]
    );

    const totalQuestions = useMemo(
        () => Object.values(draft.questionTypes).reduce((sum, definition) => sum + clampNonNegativeInteger(definition.count), 0),
        [draft.questionTypes]
    );

    const academicDifficultyDistribution = useMemo(
        () => buildAcademicDifficultyDistribution(draft.difficultyMatrix),
        [draft.difficultyMatrix]
    );

    const cognitiveDistribution = useMemo(
        () => buildCognitiveDistribution(draft.difficultyMatrix),
        [draft.difficultyMatrix]
    );

    const questionProfiles = useMemo(
        () => buildQuestionProfiles(draft.difficultyMatrix),
        [draft.difficultyMatrix]
    );

    const totalAssignedQuestions = useMemo(
        () => questionProfiles.reduce((sum, profile) => sum + clampNonNegativeInteger(profile.count), 0),
        [questionProfiles]
    );

    const sessionUploadsStillProcessing = useMemo(() => {
        if (!workflow) return false;
        return draft.uploadedInSessionIds.some((materialId) => {
            const material = workflow.materials.find((entry) => entry._id === materialId);
            return material && PROCESSING_STATUSES.includes(material.status);
        });
    }, [draft.uploadedInSessionIds, workflow]);

    const expectedTotalMarks = useMemo(() => {
        if (draft.marks.mode === 'question') {
            return Number((totalQuestions * clampNumber(draft.marks.defaultRule.reward, 1)).toFixed(2));
        }

        return Number(QUESTION_TYPES.reduce((sum, type) => {
            const count = clampNonNegativeInteger(draft.questionTypes[type.key]?.count);
            const reward = clampNumber(draft.marks.perType[type.key]?.reward, 1);
            return sum + (count * reward);
        }, 0).toFixed(2));
    }, [draft.marks, draft.questionTypes, totalQuestions]);

    const hiddenSelectedMaterialCount = useMemo(() => (
        selectedMaterials.filter((material) => !filteredReadyMaterials.some((entry) => entry._id === material._id)).length
    ), [filteredReadyMaterials, selectedMaterials]);

    const resetDraft = () => {
        if (!moduleId) return;
        const freshDraft = createWorkflowDraft();
        setDraft(freshDraft);
        window.sessionStorage.setItem(getDraftStorageKey(moduleId), JSON.stringify(freshDraft));
        setStatusMessage('Workflow draft reset.');
    };

    const updateDraft = (updater) => {
        setDraft((current) => (typeof updater === 'function' ? updater(current) : updater));
    };

    const toggleMaterial = (materialId) => {
        updateDraft((current) => {
            const isSelected = current.selectedMaterialIds.includes(materialId);
            const selectedMaterialIds = isSelected
                ? current.selectedMaterialIds.filter((id) => id !== materialId)
                : [...current.selectedMaterialIds, materialId];

            const selectedTopics = isSelected
                ? Object.fromEntries(
                    Object.entries(current.selectedTopics).filter(([topicKey]) => !topicKey.startsWith(`${materialId}:`))
                )
                : current.selectedTopics;

            return {
                ...current,
                selectedMaterialIds,
                selectedTopics,
            };
        });
    };

    const toggleTopic = (materialId, node, path, checked) => {
        updateDraft((current) => {
            const nextSelectedTopics = { ...current.selectedTopics };

            const walk = (currentNode, currentPath) => {
                const topicKey = `${materialId}:${currentPath.join('>')}`;
                if (checked) nextSelectedTopics[topicKey] = currentNode.name;
                else delete nextSelectedTopics[topicKey];

                (currentNode.children || []).forEach((child) => {
                    walk(child, [...currentPath, child.name]);
                });
            };

            walk(node, path);
            return {
                ...current,
                selectedTopics: nextSelectedTopics,
            };
        });
    };

    const selectAllTopicsForMaterial = (material) => {
        updateDraft((current) => {
            const nextSelectedTopics = { ...current.selectedTopics };
            const walk = (node, path = []) => {
                const nextPath = [...path, node.name];
                nextSelectedTopics[`${material._id}:${nextPath.join('>')}`] = node.name;
                (node.children || []).forEach((child) => walk(child, nextPath));
            };
            (material.mindmap?.concepts || []).forEach((node) => walk(node));
            return {
                ...current,
                selectedTopics: nextSelectedTopics,
            };
        });
    };

    const clearTopicsForMaterial = (materialId) => {
        updateDraft((current) => ({
            ...current,
            selectedTopics: Object.fromEntries(
                Object.entries(current.selectedTopics).filter(([topicKey]) => !topicKey.startsWith(`${materialId}:`))
            ),
        }));
    };

    const uploadMaterial = async () => {
        if (!selectedFile || !moduleId) return;

        setUploading(true);
        setStatusMessage('');

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('module_id', moduleId);
            if (uploadTitle.trim()) formData.append('title', uploadTitle.trim());
            if (draft.mindmapProviderConfigId) {
                formData.append('mindmap_provider_config_id', draft.mindmapProviderConfigId);
            }

            const response = await axiosInstance.post('/teacher/materials/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            updateDraft((current) => ({
                ...current,
                uploadedInSessionIds: response.data.materialId
                    ? [...new Set([...current.uploadedInSessionIds, response.data.materialId])]
                    : current.uploadedInSessionIds,
            }));
            setSelectedFile(null);
            setUploadTitle('');
            setStatusMessage('Material uploaded. Processing has started and the workflow will unlock when it is ready.');
            await loadWorkflow();
        } catch (error) {
            setStatusMessage(error.response?.data?.message || 'Material upload failed.');
        } finally {
            setUploading(false);
        }
    };

    const retryMaterial = async (materialId) => {
        setRetryingMaterialId(materialId);
        setStatusMessage('');

        try {
            await axiosInstance.post(`/teacher/materials/${materialId}/retry`, {
                ...(draft.mindmapProviderConfigId ? { mindmap_provider_config_id: draft.mindmapProviderConfigId } : {}),
            });
            updateDraft((current) => ({
                ...current,
                uploadedInSessionIds: [...new Set([...current.uploadedInSessionIds, materialId])],
            }));
            setStatusMessage('Material retry started. The workflow will refresh while parsing and embedding run again.');
            await loadWorkflow();
        } catch (error) {
            setStatusMessage(error.response?.data?.message || 'Material retry could not be started.');
        } finally {
            setRetryingMaterialId('');
        }
    };

    const deleteMaterial = async (material) => {
        const confirmed = window.confirm(`Delete "${material.title}" and remove its uploaded file, mind map, and embeddings?`);
        if (!confirmed) return;

        setDeletingMaterialId(material._id);
        setStatusMessage('');

        try {
            await axiosInstance.delete(`/teacher/materials/${material._id}`);
            updateDraft((current) => ({
                ...current,
                selectedMaterialIds: current.selectedMaterialIds.filter((materialId) => materialId !== material._id),
                selectedTopics: Object.fromEntries(
                    Object.entries(current.selectedTopics).filter(([topicKey]) => !topicKey.startsWith(`${material._id}:`))
                ),
                uploadedInSessionIds: current.uploadedInSessionIds.filter((materialId) => materialId !== material._id),
            }));
            setStatusMessage('Material deleted successfully.');
            await loadWorkflow();
        } catch (error) {
            setStatusMessage(error.response?.data?.message || 'Material deletion failed.');
        } finally {
            setDeletingMaterialId('');
        }
    };

    const validateStep = (stepId) => {
        if (stepId === 1) {
            if (sessionUploadsStillProcessing) {
                return 'Please wait until the uploaded material finishes processing before moving on.';
            }
            return '';
        }

        if (stepId === 2) {
            if (selectedMaterials.length === 0) return 'Select at least one ready material for this exam.';
            if (selectedTopicLabels.length === 0) return 'Select at least one topic or subtopic from the available mind maps.';
            return '';
        }

        if (stepId === 3) {
            if (totalQuestions === 0) return 'Configure at least one question before continuing.';
            if (totalQuestions > QUESTION_LIMIT) return `Question total cannot exceed ${QUESTION_LIMIT}.`;
            return '';
        }

        if (stepId === 4) {
            if (totalQuestions === 0) return 'Configure questions before setting difficulty.';
            if (totalAssignedQuestions !== totalQuestions) return 'The difficulty and Bloom allocation must add up exactly to the total number of questions.';
            return '';
        }

        if (stepId === 5) {
            const rules = draft.marks.mode === 'question'
                ? [draft.marks.defaultRule]
                : QUESTION_TYPES
                    .filter((type) => Number(draft.questionTypes[type.key]?.count || 0) > 0)
                    .map((type) => draft.marks.perType[type.key]);

            const hasInvalidRule = rules.some((rule) => ['reward', 'penalty', 'unanswered'].some((field) => !Number.isFinite(Number(rule?.[field]))));
            if (hasInvalidRule) return 'All mark distribution values must be valid numbers.';
            return '';
        }

        return '';
    };

    const goToNextStep = () => {
        const validationMessage = validateStep(draft.currentStep);
        if (validationMessage) {
            console.error('[TeacherExamWorkflow] Step transition blocked.', {
                currentStep: draft.currentStep,
                validationMessage,
                totalQuestions,
                totalAssignedQuestions,
                academicDifficultyDistribution,
                cognitiveDistribution,
                questionTypes: draft.questionTypes,
            });
            setStatusMessage(validationMessage);
            return;
        }

        setStatusMessage('');
        updateDraft((current) => ({
            ...current,
            currentStep: Math.min(5, current.currentStep + 1),
        }));
    };

    const goToPreviousStep = () => {
        updateDraft((current) => ({
            ...current,
            currentStep: Math.max(1, current.currentStep - 1),
        }));
        setStatusMessage('');
    };

    const startGeneration = async () => {
        const validationMessage = validateStep(5);
        if (validationMessage) {
            console.error('[TeacherExamWorkflow] Exam generation blocked by validation.', {
                validationMessage,
                currentStep: draft.currentStep,
                marks: draft.marks,
            });
            setStatusMessage(validationMessage);
            return;
        }

        if (!moduleId || !workflow) return;

        setSubmitting(true);
        setStatusMessage('');

        try {
            const scoringPayload = buildBlueprintScoringPayload(draft.questionTypes, draft.marks);
            const blueprintResponse = await axiosInstance.post('/teacher/blueprints', {
                moduleId: Number(moduleId),
                title: `${workflow.module.name} AI Exam Blueprint`,
                materials: draft.selectedMaterialIds,
                selectedConcepts: selectedTopicLabels,
                selectedMaterialTitles: selectedMaterials.map((material) => material.title),
                questionTypes: draft.questionTypes,
                difficultyDistribution: cognitiveDistribution,
                examProviderConfigId: draft.examProviderConfigId ? Number(draft.examProviderConfigId) : null,
                academicDifficultyDistribution,
                cognitiveDistribution,
                questionProfiles,
                ...scoringPayload,
                instructions: draft.instructions,
                totalQuestions,
            });

            navigate('/teacher/ai-exam-generator', {
                state: {
                    blueprintId: blueprintResponse.data._id,
                    moduleId: Number(moduleId),
                    workflowSummary: {
                        moduleName: workflow.module.name,
                        totalQuestions,
                        selectedTopicCount: selectedTopicLabels.length,
                    },
                },
            });
        } catch (error) {
            setStatusMessage(error.response?.data?.message || 'Exam generation could not be started.');
        } finally {
            setSubmitting(false);
        }
    };

    const actionBarConfig = useMemo(() => {
        const currentStepMeta = getCurrentStepMeta(draft.currentStep);
        const shared = {
            stepLabel: `${currentStepMeta.title} step`,
        };

        if (draft.currentStep === 1) {
            return {
                ...shared,
                summary: 'Upload or verify study materials before moving into topic selection.',
                backLabel: 'Back to modules',
                nextLabel: 'Next: topic selection',
                onBack: () => navigate('/teacher/modules'),
                onNext: goToNextStep,
                nextDisabled: sessionUploadsStillProcessing,
            };
        }

        if (draft.currentStep === 2) {
            return {
                ...shared,
                summary: `${selectedMaterials.length} material(s) selected and ${selectedTopicLabels.length} topic(s) chosen.`,
                backLabel: 'Previous',
                nextLabel: 'Next: question design',
                onBack: goToPreviousStep,
                onNext: goToNextStep,
                nextDisabled: moduleReadyMaterials.length === 0,
            };
        }

        if (draft.currentStep === 3) {
            return {
                ...shared,
                summary: `${totalQuestions} question(s) configured across ${QUESTION_TYPES.filter((type) => Number(draft.questionTypes[type.key]?.count || 0) > 0).length} active type(s).`,
                backLabel: 'Previous',
                nextLabel: 'Next: difficulty setup',
                onBack: goToPreviousStep,
                onNext: goToNextStep,
                nextDisabled: false,
            };
        }

        if (draft.currentStep === 4) {
            return {
                ...shared,
                summary: `${totalAssignedQuestions}/${totalQuestions} questions mapped across academic difficulty and Bloom levels.`,
                backLabel: 'Previous',
                nextLabel: 'Next: marks distribution',
                onBack: goToPreviousStep,
                onNext: goToNextStep,
                nextDisabled: false,
            };
        }

        return {
            ...shared,
            summary: `Ready to generate a ${totalQuestions}-question draft with ${selectedTopicLabels.length} selected topic(s).`,
            backLabel: 'Previous',
            nextLabel: 'Generate exam draft',
            onBack: goToPreviousStep,
            onNext: startGeneration,
            nextDisabled: false,
            loading: submitting,
        };
    }, [
        academicDifficultyDistribution,
        cognitiveDistribution,
        draft.currentStep,
        draft.examProviderConfigId,
        draft.mindmapProviderConfigId,
        draft.questionTypes,
        moduleReadyMaterials.length,
        navigate,
        questionProfiles,
        selectedExamProvider,
        selectedMindmapProvider,
        selectedMaterials.length,
        selectedTopicLabels.length,
        sessionUploadsStillProcessing,
        submitting,
        totalAssignedQuestions,
        totalQuestions,
        goToNextStep,
        goToPreviousStep,
        startGeneration,
    ]);

    const renderStepContent = () => {
        if (!workflow) {
            return <div className="flex h-72 items-center justify-center text-slate-400">Loading workflow...</div>;
        }

        if (draft.currentStep === 1) {
            return (
                <StepShell
                    eyebrow="Step 1"
                    title="Upload Study Material"
                    subtitle="Upload fresh material for this module or continue with the existing ready materials. If you do upload now, the Next button stays locked until parsing, processing, and mind map generation finish."
                >
                    <div className="grid gap-4 lg:grid-cols-[1fr,1fr,auto]">
                        <input
                            className="input-field"
                            placeholder="Optional material title"
                            value={uploadTitle}
                            onChange={(event) => setUploadTitle(event.target.value)}
                        />
                        <input
                            type="file"
                            className="input-field file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                            accept=".pdf,.docx,.txt,.md,.pptx"
                            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                        />
                        <button type="button" onClick={uploadMaterial} disabled={!selectedFile || uploading} className="action-button">
                            {uploading ? 'Uploading...' : 'Upload material'}
                        </button>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className="surface-muted p-4">
                            <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                                <span>Mindmap LLM</span>
                                <Tooltip text="This LLM is used after embedding to turn uploaded material into the initial concept map and topic hierarchy.">
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] text-slate-700">
                                        <FiHelpCircle />
                                    </span>
                                </Tooltip>
                            </label>
                            <select
                                className="select-field"
                                value={draft.mindmapProviderConfigId}
                                onChange={(event) => updateDraft((current) => ({
                                    ...current,
                                    mindmapProviderConfigId: event.target.value,
                                }))}
                                disabled={loadingAiOptions}
                            >
                                <option value="">System default</option>
                                {aiOptions.llmProviders.map((provider) => (
                                    <option key={`mindmap-${provider.id}`} value={provider.id}>
                                        {provider.label} | {provider.model_name}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-2 text-sm text-slate-500">
                                {selectedMindmapProvider
                                    ? `${selectedMindmapProvider.description || 'Selected for topic-map generation.'}${selectedMindmapProvider.base_url ? ` Host: ${selectedMindmapProvider.base_url}` : ''}`
                                    : 'If no provider is selected, the server falls back to the system default LLM configuration.'}
                            </p>
                        </div>

                        <div className="surface-muted p-4">
                            <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                                <span>Embedding service</span>
                                <Tooltip text="The embedding service is chosen globally by the superadmin and is used for chunk vectors, retrieval, and question grounding.">
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] text-slate-700">
                                        <FiHelpCircle />
                                    </span>
                                </Tooltip>
                            </label>
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <p className="font-bold text-slate-900">{aiOptions.embeddingProvider?.label || 'System embedding default'}</p>
                                <p className="mt-1 text-sm text-slate-500">
                                    {(aiOptions.embeddingProvider?.provider_name || 'Default provider')} | {(aiOptions.embeddingProvider?.model_name || 'Default model')}
                                </p>
                                <p className="mt-2 text-sm text-slate-500">
                                    {aiOptions.embeddingProvider?.description || 'This service is managed globally by the superadmin and applied to every retrieval operation.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {sessionUploadsStillProcessing ? (
                        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
                            Your latest upload is still processing. Wait for all stages to reach Ready before continuing.
                        </div>
                    ) : null}

                    <div className="space-y-4">
                        {workflow.materials.length === 0 ? (
                            <div className="empty-state">
                                <FiUploadCloud className="mx-auto text-4xl text-slate-300" />
                                <p className="mt-4 text-lg font-bold text-slate-700">No study material yet</p>
                                <p className="mt-2 text-sm text-slate-500">Upload a PDF, DOCX, PPTX, TXT, or Markdown file to start the guided exam flow.</p>
                            </div>
                        ) : (
                            workflow.materials.map((material) => {
                                const currentStage = MATERIAL_STAGE_INDEX[material.status] ?? 0;
                                const isReady = material.status === READY_STATUS;
                                const isFailed = FAILED_STATUSES.includes(material.status);

                                return (
                                    <div key={material._id} className="surface-muted p-5">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <p className="text-lg font-bold text-slate-900">{material.title}</p>
                                                <p className="mt-1 text-sm text-slate-500">{formatStatusLabel(material.status)}</p>
                                                <p className="mt-2 text-sm text-slate-500">{material.statusMessage || material.errorMessage || 'No status details yet.'}</p>
                                            </div>
                                            <span className={`status-badge ${
                                                isReady
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                    : isFailed
                                                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                                                        : 'border-slate-200 bg-white text-slate-600'
                                            }`}>
                                                {isReady ? <FiCheckCircle /> : isFailed ? <FiAlertCircle /> : <FiClock />}
                                                <span>{formatStatusLabel(material.status)}</span>
                                            </span>
                                        </div>

                                        {isFailed ? (
                                            <div className="mt-5 rounded-[24px] border border-rose-200 bg-rose-50 p-4">
                                                <p className="text-sm font-semibold text-rose-700">{material.errorMessage || material.statusMessage || 'Material processing failed.'}</p>
                                                <div className="mt-4 flex flex-wrap gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => retryMaterial(material._id)}
                                                        disabled={retryingMaterialId === material._id}
                                                        className="ghost-button !border-rose-200 !bg-white !text-rose-700 hover:!bg-rose-100"
                                                    >
                                                        <FiRefreshCw className={retryingMaterialId === material._id ? 'animate-spin' : ''} />
                                                        <span>{retryingMaterialId === material._id ? 'Retrying...' : 'Retry processing'}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteMaterial(material)}
                                                        disabled={deletingMaterialId === material._id}
                                                        className="ghost-button !border-rose-200 !bg-white !text-rose-700 hover:!bg-rose-100"
                                                    >
                                                        <FiTrash2 />
                                                        <span>{deletingMaterialId === material._id ? 'Deleting...' : 'Delete material'}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-5 grid gap-3 md:grid-cols-5">
                                                {MATERIAL_PROGRESS.map((stage, index) => {
                                                    const done = currentStage > index || material.status === READY_STATUS;
                                                    const active = material.status !== READY_STATUS && currentStage === index;
                                                    return (
                                                        <div
                                                            key={`${material._id}-${stage.key}`}
                                                            className={`rounded-2xl border px-3 py-3 text-sm font-semibold ${
                                                                active
                                                                    ? 'border-cyan-300 bg-cyan-50 text-cyan-700'
                                                                    : done
                                                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                                        : 'border-slate-200 bg-white text-slate-400'
                                                            }`}
                                                        >
                                                            {stage.label}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </StepShell>
            );
        }

        if (draft.currentStep === 2) {
            return (
                <StepShell
                    eyebrow="Step 2"
                    title="Select Topics from Mind Maps"
                    subtitle="Choose the ready materials that should drive the exam, then select the exact topics and subtopics the AI should focus on."
                >
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="surface-muted p-4">
                            <p className="text-sm font-semibold text-slate-500">Ready materials</p>
                            <p className="mt-2 text-2xl font-extrabold text-slate-900">{moduleReadyMaterials.length}</p>
                        </div>
                        <div className="surface-muted p-4">
                            <p className="text-sm font-semibold text-slate-500">Selected materials</p>
                            <p className="mt-2 text-2xl font-extrabold text-slate-900">{selectedMaterials.length}</p>
                        </div>
                        <div className="surface-muted p-4">
                            <p className="text-sm font-semibold text-slate-500">Selected topics</p>
                            <p className="mt-2 text-2xl font-extrabold text-slate-900">{selectedTopicLabels.length}</p>
                        </div>
                    </div>

                    <div className="surface-muted p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="relative lg:max-w-md lg:flex-1">
                                <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    className="input-field !pl-11"
                                    placeholder="Search materials by title"
                                    value={materialSearchQuery}
                                    onChange={(event) => setMaterialSearchQuery(event.target.value)}
                                />
                            </div>
                            <p className="text-sm text-slate-500">
                                {filteredReadyMaterials.length} of {moduleReadyMaterials.length} ready material(s) shown.
                                {hiddenSelectedMaterialCount > 0 ? ` ${hiddenSelectedMaterialCount} selected material(s) are hidden by the current search.` : ''}
                            </p>
                        </div>
                    </div>

                    {moduleReadyMaterials.length === 0 ? (
                        <div className="empty-state">
                            <FiCpu className="mx-auto text-4xl text-slate-300" />
                            <p className="mt-4 text-lg font-bold text-slate-700">No ready material available</p>
                            <p className="mt-2 text-sm text-slate-500">Finish processing at least one uploaded material before you choose topics.</p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {filteredReadyMaterials.length === 0 ? (
                                <div className="rounded-[24px] border border-slate-200 bg-white p-6 text-sm text-slate-500">
                                    No ready materials match the current search. Selected materials stay preserved even when hidden by the filter.
                                </div>
                            ) : filteredReadyMaterials.map((material) => {
                                const isSelected = draft.selectedMaterialIds.includes(material._id);
                                return (
                                    <div key={material._id} className="surface-muted p-5">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-3 text-sm font-bold text-slate-800">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleMaterial(material._id)}
                                                        className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                                    />
                                                    <span>{material.title}</span>
                                                </label>
                                                <p className="text-sm text-slate-500">Only selected materials contribute to retrieval and exam generation.</p>
                                            </div>
                                            <div className="flex gap-3">
                                                <button type="button" onClick={() => selectAllTopicsForMaterial(material)} disabled={!isSelected || !material.mindmap?.concepts?.length} className="ghost-button !px-4 !py-2">
                                                    Select all topics
                                                </button>
                                                <button type="button" onClick={() => clearTopicsForMaterial(material._id)} disabled={!isSelected} className="ghost-button !px-4 !py-2">
                                                    Clear topics
                                                </button>
                                            </div>
                                        </div>

                                        {material.mindmap?.concepts?.length ? (
                                            <div className={`mt-5 rounded-[24px] border p-4 ${isSelected ? 'border-cyan-200 bg-white' : 'border-slate-200 bg-slate-50/70'}`}>
                                                <p className="mb-4 text-sm font-bold text-slate-700">{material.mindmap.title || 'Generated topics'}</p>
                                                {material.mindmap.concepts.map((node, index) => (
                                                    <TopicTree
                                                        key={`${material._id}-${node.name}-${index}`}
                                                        materialId={material._id}
                                                        node={node}
                                                        selectedTopics={draft.selectedTopics}
                                                        onToggle={toggleTopic}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4 text-sm text-slate-500">
                                                Mind map is not available for this material yet.
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </StepShell>
            );
        }

        if (draft.currentStep === 3) {
            return (
                <StepShell
                    eyebrow="Step 3"
                    title="Choose Question Types and Counts"
                    subtitle="Set the exact structure of the exam. Totals are validated before the workflow can continue."
                >
                    <div className="grid gap-4 md:grid-cols-2">
                        {QUESTION_TYPES.map((type) => (
                            <div key={type.key} className="surface-muted p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-lg font-bold text-slate-900">{type.label}</p>
                                        <p className="mt-1 text-sm text-slate-500">{type.description}</p>
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        className="input-field w-24 !py-2 text-center"
                                        value={draft.questionTypes[type.key].count}
                                        onChange={(event) => updateDraft((current) => ({
                                            ...current,
                                            questionTypes: {
                                                ...current.questionTypes,
                                                [type.key]: {
                                                    ...current.questionTypes[type.key],
                                                    count: clampNonNegativeInteger(event.target.value),
                                                },
                                            },
                                        }))}
                                    />
                                </div>

                                {type.supportsOptions ? (
                                    <div className="mt-4">
                                        <label className="label-text">Options per question</label>
                                        <input
                                            type="number"
                                            min="2"
                                            max="10"
                                            className="input-field w-28 !py-2 text-center"
                                            value={draft.questionTypes[type.key].options}
                                            onChange={(event) => updateDraft((current) => ({
                                                ...current,
                                                questionTypes: {
                                                    ...current.questionTypes,
                                                    [type.key]: {
                                                        ...current.questionTypes[type.key],
                                                        options: Math.min(10, Math.max(2, clampNonNegativeInteger(event.target.value) || 2)),
                                                    },
                                                },
                                            }))}
                                        />
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="surface-muted p-4">
                            <p className="text-sm font-semibold text-slate-500">Total questions</p>
                            <p className="mt-2 text-3xl font-extrabold text-slate-900">{totalQuestions}</p>
                        </div>
                        <div className="surface-muted p-4">
                            <p className="text-sm font-semibold text-slate-500">Question limit</p>
                            <p className="mt-2 text-3xl font-extrabold text-slate-900">{QUESTION_LIMIT}</p>
                        </div>
                        <div className="surface-muted p-4">
                            <p className="text-sm font-semibold text-slate-500">Configured types</p>
                            <p className="mt-2 text-3xl font-extrabold text-slate-900">
                                {QUESTION_TYPES.filter((type) => Number(draft.questionTypes[type.key].count) > 0).length}
                            </p>
                        </div>
                    </div>

                </StepShell>
            );
        }

        if (draft.currentStep === 4) {
            return (
                <StepShell
                    eyebrow="Step 4"
                    title="Configure Difficulty and Bloom's Taxonomy"
                    subtitle="Assign each question to both an academic difficulty tier and a Bloom cognitive level. The total number of cells in the matrix must match the question count from Step 3."
                >
                    <div className="overflow-x-auto rounded-[28px] border border-slate-200 bg-white">
                        <table className="min-w-full border-collapse">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Difficulty</th>
                                    {BLOOM_LEVELS.map((level) => (
                                        <th key={level.key} className="px-4 py-4 text-center text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                                            <span className="inline-flex items-center gap-2">
                                                <span>{level.label}</span>
                                                <Tooltip text={level.helper}>
                                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                                                        <FiHelpCircle />
                                                    </span>
                                                </Tooltip>
                                            </span>
                                        </th>
                                    ))}
                                    <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Row total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {DIFFICULTY_TIERS.map((difficulty) => (
                                    <tr key={difficulty.key} className="border-t border-slate-100">
                                        <td className="px-4 py-4 align-top">
                                            <p className="font-bold text-slate-900">{difficulty.label}</p>
                                            <p className="mt-1 text-sm text-slate-500">{difficulty.helper}</p>
                                        </td>
                                        {BLOOM_LEVELS.map((level) => (
                                            <td key={`${difficulty.key}-${level.key}`} className="px-4 py-4 text-center">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="input-field mx-auto w-24 !py-2 text-center"
                                                    value={draft.difficultyMatrix[difficulty.key][level.key]}
                                                    onChange={(event) => updateDraft((current) => ({
                                                        ...current,
                                                        difficultyMatrix: {
                                                            ...current.difficultyMatrix,
                                                            [difficulty.key]: {
                                                                ...current.difficultyMatrix[difficulty.key],
                                                                [level.key]: clampNonNegativeInteger(event.target.value),
                                                            },
                                                        },
                                                    }))}
                                                />
                                            </td>
                                        ))}
                                        <td className="px-4 py-4 text-center text-lg font-extrabold text-slate-900">
                                            {academicDifficultyDistribution[difficulty.key]}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="border-t border-slate-200 bg-slate-50">
                                <tr>
                                    <td className="px-4 py-4 text-sm font-bold text-slate-700">Column totals</td>
                                    {BLOOM_LEVELS.map((level) => (
                                        <td key={`total-${level.key}`} className="px-4 py-4 text-center text-lg font-extrabold text-slate-900">
                                            {cognitiveDistribution[level.key]}
                                        </td>
                                    ))}
                                    <td className="px-4 py-4 text-center text-lg font-extrabold text-slate-900">{totalAssignedQuestions}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
                        <div className="surface-muted p-5">
                            <p className="text-sm font-semibold text-slate-500">Allocation health</p>
                            <p className="mt-2 text-3xl font-extrabold text-slate-900">{totalAssignedQuestions} / {totalQuestions}</p>
                            <p className="mt-2 text-sm text-slate-500">Every question should be represented once in the matrix before you continue.</p>
                        </div>
                        <div className="surface-muted p-5">
                            <p className="text-sm font-semibold text-slate-500">LLM profile payload</p>
                            <div className="mt-4 space-y-2">
                                {questionProfiles.length === 0 ? (
                                    <p className="text-sm text-slate-500">No difficulty/Bloom pairings configured yet.</p>
                                ) : questionProfiles.map((profile) => (
                                    <div key={`${profile.difficulty}-${profile.cognitiveLevel}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                                        {profile.count} question(s): {DIFFICULTY_TIERS.find((tier) => tier.key === profile.difficulty)?.label} + {BLOOM_LEVELS.find((level) => level.key === profile.cognitiveLevel)?.label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </StepShell>
            );
        }

        return (
            <StepShell
                eyebrow="Step 5"
                title="Marks Distribution and Generation"
                subtitle="Choose whether marks are applied globally per question or by section, then launch the draft generation. The review and manual editing stage is Step 6 after the AI creates the draft."
            >
                <div className="grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
                    <div className="space-y-4">
                        <div className="surface-muted p-5">
                            <p className="text-sm font-semibold text-slate-500">Marking mode</p>
                            <div className="mt-4 space-y-3">
                                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                                    <input
                                        type="radio"
                                        checked={draft.marks.mode === 'question'}
                                        onChange={() => updateDraft((current) => ({
                                            ...current,
                                            marks: {
                                                ...current.marks,
                                                mode: 'question',
                                            },
                                        }))}
                                        className="mt-1 h-4 w-4 text-cyan-600 focus:ring-cyan-500"
                                    />
                                    <span>
                                        <span className="block font-bold text-slate-900">Per question</span>
                                        <span className="mt-1 block text-sm text-slate-500">Apply one default score rule to the full draft, then optionally fine-tune individual questions during review.</span>
                                    </span>
                                </label>
                                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                                    <input
                                        type="radio"
                                        checked={draft.marks.mode === 'section'}
                                        onChange={() => updateDraft((current) => ({
                                            ...current,
                                            marks: {
                                                ...current.marks,
                                                mode: 'section',
                                            },
                                        }))}
                                        className="mt-1 h-4 w-4 text-cyan-600 focus:ring-cyan-500"
                                    />
                                    <span>
                                        <span className="block font-bold text-slate-900">Per section</span>
                                        <span className="mt-1 block text-sm text-slate-500">Assign marks by question type so each section carries its own weight from the moment the draft is generated.</span>
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div className="surface-muted p-5">
                            <p className="text-sm font-semibold text-slate-500">Generation notes</p>
                            <textarea
                                rows={7}
                                className="textarea-field mt-4"
                                placeholder="Optional instructions for the AI: scope, tone, course outcomes, wording constraints, topics to emphasize, topics to avoid..."
                                value={draft.instructions}
                                onChange={(event) => updateDraft((current) => ({
                                    ...current,
                                    instructions: event.target.value,
                                }))}
                            />
                        </div>

                    </div>

                    <div className="space-y-4">
                        {draft.marks.mode === 'question' ? (
                            <div className="surface-muted p-5">
                                <p className="text-sm font-semibold text-slate-500">Default rule for every generated question</p>
                                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                                    {[
                                        { key: 'reward', label: 'Correct' },
                                        { key: 'penalty', label: 'Incorrect' },
                                        { key: 'unanswered', label: 'Unanswered' },
                                    ].map((field) => (
                                        <div key={field.key}>
                                            <label className="label-text">{field.label}</label>
                                            <input
                                                type="number"
                                                step="0.25"
                                                className="input-field"
                                                value={draft.marks.defaultRule[field.key]}
                                                onChange={(event) => updateDraft((current) => ({
                                                    ...current,
                                                    marks: {
                                                        ...current.marks,
                                                        defaultRule: {
                                                            ...current.marks.defaultRule,
                                                            [field.key]: clampNumber(event.target.value, 0),
                                                        },
                                                    },
                                                }))}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="surface-muted p-5">
                                <p className="text-sm font-semibold text-slate-500">Section rules by question type</p>
                                <div className="mt-4 space-y-4">
                                    {QUESTION_TYPES.filter((type) => Number(draft.questionTypes[type.key]?.count || 0) > 0).map((type) => (
                                        <div key={type.key} className="rounded-[24px] border border-slate-200 bg-white p-4">
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <p className="font-bold text-slate-900">{type.label}</p>
                                                    <p className="mt-1 text-sm text-slate-500">{draft.questionTypes[type.key].count} question(s)</p>
                                                </div>
                                                <div className="grid gap-3 sm:grid-cols-3">
                                                    {[
                                                        { key: 'reward', label: 'Correct' },
                                                        { key: 'penalty', label: 'Incorrect' },
                                                        { key: 'unanswered', label: 'Unanswered' },
                                                    ].map((field) => (
                                                        <div key={`${type.key}-${field.key}`}>
                                                            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{field.label}</label>
                                                            <input
                                                                type="number"
                                                                step="0.25"
                                                                className="input-field !py-2"
                                                                value={draft.marks.perType[type.key][field.key]}
                                                                onChange={(event) => updateDraft((current) => ({
                                                                    ...current,
                                                                    marks: {
                                                                        ...current.marks,
                                                                        perType: {
                                                                            ...current.marks.perType,
                                                                            [type.key]: {
                                                                                ...current.marks.perType[type.key],
                                                                                [field.key]: clampNumber(event.target.value, 0),
                                                                            },
                                                                        },
                                                                    },
                                                                }))}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="surface-muted p-5">
                            <p className="text-sm font-semibold text-slate-500">Exam readiness summary</p>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Materials selected: {selectedMaterials.length}</div>
                                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Topics selected: {selectedTopicLabels.length}</div>
                                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Questions configured: {totalQuestions}</div>
                                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Expected max score: {expectedTotalMarks}</div>
                            </div>
                        </div>
                    </div>
                </div>

            </StepShell>
        );
    };

    if (!moduleId) {
        return (
            <div className="space-y-8">
                <header className="page-hero">
                    <p className="eyebrow">Exam Workflow</p>
                    <h1 className="page-title">Choose a module to launch the guided exam workflow</h1>
                    <p className="page-subtitle">The restored flow walks teachers from study material upload through topic selection, blueprint setup, and final draft review.</p>
                </header>

                <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-slate-500">Select a module to continue.</p>
                    <Link to="/teacher/modules" className="ghost-button">
                        <FiArrowLeft />
                        <span>Back to modules</span>
                    </Link>
                </div>

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {modules.map((module) => (
                        <Link
                            key={module.id}
                            to={`/teacher/exam-workflow/${module.id}`}
                            className="surface-card p-6 transition duration-200 hover:-translate-y-1 hover:shadow-[0_26px_80px_rgba(15,23,42,0.13)]"
                        >
                            <p className="eyebrow !text-slate-400">{module.abbreviation}</p>
                            <h2 className="mt-4 text-xl font-extrabold text-slate-900">{module.name}</h2>
                            <p className="mt-2 text-sm text-slate-500">{module.groups.length} group(s) assigned</p>
                        </Link>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20">
            <header className="page-hero">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="eyebrow">Teacher Exam Workflow</p>
                        <h1 className="page-title">{workflow?.module?.name || 'Loading module...'}</h1>
                        <p className="page-subtitle">A restored step-by-step flow with persistent state, processing-aware navigation, and a clean handoff to generation and review.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={resetDraft} className="ghost-button !border-white/20 !bg-white/10 !text-white hover:!bg-white/20">
                            Reset draft
                        </button>
                        <Link to={`/teacher/modules/${moduleId}`} className="ghost-button !border-white/20 !bg-white/10 !text-white hover:!bg-white/20">
                            <FiArrowLeft />
                            <span>Back to module</span>
                        </Link>
                    </div>
                </div>
            </header>

            <ExamLlmPicker
                providers={aiOptions.llmProviders}
                selectedProviderId={draft.examProviderConfigId}
                selectedProvider={selectedExamProvider}
                loading={loadingAiOptions}
                onChange={(providerId) => updateDraft((current) => ({
                    ...current,
                    examProviderConfigId: providerId,
                }))}
            />

            <WorkflowStepper currentStep={draft.currentStep} />

            <WorkflowActionBar {...actionBarConfig} />

            {statusMessage ? (
                <div className="surface-card bg-slate-900 p-4 text-sm font-semibold text-white">{statusMessage}</div>
            ) : null}

            {loadingWorkflow && !workflow ? (
                <div className="flex h-72 items-center justify-center text-slate-400">Loading workflow...</div>
            ) : (
                renderStepContent()
            )}
        </div>
    );
};

export default TeacherExamWorkflow;
