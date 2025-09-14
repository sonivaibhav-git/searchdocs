// HuggingFace API integration for document summarization
import { supabase } from './supabase'

const HUGGINGFACE_API_KEY = import.meta.env.VITE_HUGGINGFACE_API_KEY
const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models'

// Role-specific summarization prompts
const ROLE_PROMPTS = {
  STATION_CTRL: {
    model: 'facebook/bart-large-cnn',
    prompt: 'Summarize this document focusing on operational impacts, safety concerns, immediate actions required, and timeline. Highlight any incidents, delays, or emergency protocols.',
    maxLength: 200
  },
  ROLLING_STOCK: {
    model: 'facebook/bart-large-cnn', 
    prompt: 'Summarize focusing on technical details, maintenance requirements, equipment status, spare parts needs, and engineering implications.',
    maxLength: 250
  },
  PROCUREMENT: {
    model: 'facebook/bart-large-cnn',
    prompt: 'Summarize focusing on financial implications, contract terms, vendor details, budget impact, deadlines, and compliance requirements.',
    maxLength: 200
  },
  HR: {
    model: 'facebook/bart-large-cnn',
    prompt: 'Summarize focusing on personnel impacts, training requirements, policy changes, staff allocation, and compliance with HR regulations.',
    maxLength: 200
  },
  SAFETY: {
    model: 'facebook/bart-large-cnn',
    prompt: 'Summarize focusing on safety implications, regulatory compliance, risk assessment, corrective actions, and deadline requirements.',
    maxLength: 250
  },
  EXECUTIVE: {
    model: 'facebook/bart-large-cnn',
    prompt: 'Provide executive summary focusing on strategic impact, cross-departmental implications, risks, financial impact, and key decisions required.',
    maxLength: 300
  }
}

interface SummarizationResult {
  summary: string
  keyPoints: string[]
  actionItems: string[]
  priorityScore: number
  severity: number
}

export class HuggingFaceService {
  private apiKey: string

  constructor() {
    this.apiKey = HUGGINGFACE_API_KEY || ''
    if (!this.apiKey) {
      console.warn('HuggingFace API key not found. Document summarization will be disabled.')
    }
  }

  async summarizeDocument(
    content: string, 
    roleCode: keyof typeof ROLE_PROMPTS,
    documentTitle: string = ''
  ): Promise<SummarizationResult> {
    if (!this.apiKey) {
      return this.getFallbackSummary(content, roleCode)
    }

    try {
      const roleConfig = ROLE_PROMPTS[roleCode]
      const modelUrl = `${HUGGINGFACE_API_URL}/${roleConfig.model}`
      
      // Prepare the text for summarization
      const textToSummarize = this.prepareTextForSummarization(content, documentTitle)
      
      const response = await fetch(modelUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: textToSummarize,
          parameters: {
            max_length: roleConfig.maxLength,
            min_length: 50,
            do_sample: false,
            early_stopping: true
          }
        })
      })

      if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.status}`)
      }

      const result = await response.json()
      const summaryText = result[0]?.summary_text || result[0]?.generated_text || ''

      return this.processSummaryResult(summaryText, content, roleCode)
    } catch (error) {
      console.error('HuggingFace summarization error:', error)
      return this.getFallbackSummary(content, roleCode)
    }
  }

  private prepareTextForSummarization(content: string, title: string): string {
    // Clean and prepare text
    let text = content.replace(/\s+/g, ' ').trim()
    
    // Add title context if available
    if (title) {
      text = `Document: ${title}\n\nContent: ${text}`
    }
    
    // Limit text length for API efficiency (most models have token limits)
    if (text.length > 4000) {
      text = text.substring(0, 4000) + '...'
    }
    
    return text
  }

  private processSummaryResult(
    summaryText: string, 
    originalContent: string, 
    roleCode: keyof typeof ROLE_PROMPTS
  ): SummarizationResult {
    // Extract key points and action items using simple text analysis
    const keyPoints = this.extractKeyPoints(summaryText, originalContent)
    const actionItems = this.extractActionItems(summaryText, originalContent)
    const priorityScore = this.calculatePriorityScore(summaryText, roleCode)
    const severity = this.calculateSeverity(summaryText, originalContent)

    return {
      summary: summaryText,
      keyPoints,
      actionItems,
      priorityScore,
      severity
    }
  }

  private extractKeyPoints(summary: string, content: string): string[] {
    const keyPoints: string[] = []
    
    // Look for bullet points, numbered lists, or key phrases
    const bulletRegex = /[•\-\*]\s*([^•\-\*\n]+)/g
    const numberedRegex = /\d+\.\s*([^\d\n]+)/g
    
    let match
    while ((match = bulletRegex.exec(summary)) !== null) {
      keyPoints.push(match[1].trim())
    }
    
    while ((match = numberedRegex.exec(summary)) !== null) {
      keyPoints.push(match[1].trim())
    }
    
    // If no structured points found, extract sentences with key indicators
    if (keyPoints.length === 0) {
      const sentences = summary.split(/[.!?]+/)
      const keywordIndicators = ['important', 'critical', 'urgent', 'required', 'must', 'should', 'deadline']
      
      sentences.forEach(sentence => {
        const lowerSentence = sentence.toLowerCase()
        if (keywordIndicators.some(keyword => lowerSentence.includes(keyword))) {
          keyPoints.push(sentence.trim())
        }
      })
    }
    
    return keyPoints.slice(0, 5) // Limit to 5 key points
  }

  private extractActionItems(summary: string, content: string): string[] {
    const actionItems: string[] = []
    
    // Look for action-oriented phrases
    const actionRegex = /(must|should|need to|required to|action:|todo:|follow up:)\s*([^.!?\n]+)/gi
    
    let match
    while ((match = actionRegex.exec(summary)) !== null) {
      actionItems.push(match[2].trim())
    }
    
    // Look for imperative sentences
    const sentences = summary.split(/[.!?]+/)
    const actionVerbs = ['implement', 'review', 'update', 'complete', 'submit', 'approve', 'schedule', 'contact']
    
    sentences.forEach(sentence => {
      const trimmed = sentence.trim()
      if (actionVerbs.some(verb => trimmed.toLowerCase().startsWith(verb))) {
        actionItems.push(trimmed)
      }
    })
    
    return actionItems.slice(0, 3) // Limit to 3 action items
  }

  private calculatePriorityScore(summary: string, roleCode: keyof typeof ROLE_PROMPTS): number {
    const lowerSummary = summary.toLowerCase()
    let score = 1
    
    // High priority indicators
    const highPriorityWords = ['urgent', 'critical', 'emergency', 'immediate', 'asap']
    const mediumPriorityWords = ['important', 'priority', 'deadline', 'required']
    
    highPriorityWords.forEach(word => {
      if (lowerSummary.includes(word)) score += 3
    })
    
    mediumPriorityWords.forEach(word => {
      if (lowerSummary.includes(word)) score += 2
    })
    
    // Role-specific priority adjustments
    if (roleCode === 'STATION_CTRL' && lowerSummary.includes('incident')) score += 2
    if (roleCode === 'SAFETY' && lowerSummary.includes('safety')) score += 2
    if (roleCode === 'EXECUTIVE' && lowerSummary.includes('risk')) score += 1
    
    return Math.min(score, 10) // Cap at 10
  }

  private calculateSeverity(summary: string, content: string): number {
    const lowerText = (summary + ' ' + content).toLowerCase()
    let severity = 1
    
    // Severity indicators
    const criticalWords = ['critical', 'severe', 'major', 'emergency']
    const highWords = ['high', 'significant', 'important', 'urgent']
    const mediumWords = ['moderate', 'medium', 'notable']
    
    criticalWords.forEach(word => {
      if (lowerText.includes(word)) severity = Math.max(severity, 5)
    })
    
    highWords.forEach(word => {
      if (lowerText.includes(word)) severity = Math.max(severity, 4)
    })
    
    mediumWords.forEach(word => {
      if (lowerText.includes(word)) severity = Math.max(severity, 3)
    })
    
    return severity
  }

  private getFallbackSummary(content: string, roleCode: keyof typeof ROLE_PROMPTS): SummarizationResult {
    // Simple extractive summarization as fallback
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20)
    const summaryLength = Math.min(3, sentences.length)
    const summary = sentences.slice(0, summaryLength).join('. ') + '.'
    
    return {
      summary: summary || 'Document content processed. Full text available in document viewer.',
      keyPoints: sentences.slice(0, 3).map(s => s.trim()),
      actionItems: [],
      priorityScore: 2,
      severity: 2
    }
  }

  async summarizeForAllRoles(documentId: string, content: string, title: string): Promise<void> {
    const roles = Object.keys(ROLE_PROMPTS) as (keyof typeof ROLE_PROMPTS)[]
    
    for (const roleCode of roles) {
      try {
        const result = await this.summarizeDocument(content, roleCode, title)
        
        // Store summary in database
        await supabase
          .from('document_summaries')
          .upsert({
            document_id: documentId,
            role_code: roleCode,
            summary_text: result.summary,
            key_points: result.keyPoints,
            action_items: result.actionItems,
            priority_score: result.priorityScore
          })
        
        // Update document severity if this is the highest
        const { data: currentDoc } = await supabase
          .from('documents')
          .select('severity_level')
          .eq('id', documentId)
          .single()
        
        if (!currentDoc || result.severity > (currentDoc.severity_level || 1)) {
          await supabase
            .from('documents')
            .update({ severity_level: result.severity })
            .eq('id', documentId)
        }
        
      } catch (error) {
        console.error(`Failed to summarize for role ${roleCode}:`, error)
      }
    }
  }
}

export const huggingFaceService = new HuggingFaceService()