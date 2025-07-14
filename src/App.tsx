import { useState, useEffect, useCallback } from 'react'
import { blink } from './lib/blink'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Badge } from './components/ui/badge'
import { Progress } from './components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Alert, AlertDescription } from './components/ui/alert'
import { Separator } from './components/ui/separator'
import { 
  Search, 
  Globe, 
  Zap, 
  Shield, 
  Palette, 
  Users, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Download,
  History,
  Loader2,
  ExternalLink,
  Star,
  Clock
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface AnalysisResult {
  id: string
  url: string
  timestamp: number
  performance: {
    score: number
    metrics: {
      loadTime: number
      firstContentfulPaint: number
      largestContentfulPaint: number
      cumulativeLayoutShift: number
    }
    recommendations: string[]
  }
  seo: {
    score: number
    issues: Array<{
      type: 'error' | 'warning' | 'info'
      message: string
      impact: 'high' | 'medium' | 'low'
    }>
    recommendations: string[]
  }
  accessibility: {
    score: number
    violations: Array<{
      severity: 'critical' | 'serious' | 'moderate' | 'minor'
      description: string
      element: string
    }>
    recommendations: string[]
  }
  design: {
    score: number
    analysis: {
      colorContrast: number
      typography: number
      layout: number
      responsiveness: number
    }
    recommendations: string[]
  }
  ux: {
    score: number
    metrics: {
      navigationClarity: number
      contentReadability: number
      mobileUsability: number
      interactionDesign: number
    }
    recommendations: string[]
  }
}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [history, setHistory] = useState<AnalysisResult[]>([])

  const loadHistory = useCallback(async () => {
    if (!user) return
    
    try {
      const analyses = await blink.db.websiteAnalyses.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 10
      })
      
      // Parse the stored analysis data
      const parsedHistory = analyses.map(item => {
        try {
          const analysisData = JSON.parse(item.analysisData)
          return {
            id: item.id,
            url: item.url,
            timestamp: item.timestamp,
            ...analysisData
          }
        } catch (error) {
          console.error('Failed to parse analysis data:', error)
          // Return a fallback structure
          return {
            id: item.id,
            url: item.url,
            timestamp: item.timestamp,
            performance: { score: item.performanceScore || 0, metrics: { loadTime: 0, firstContentfulPaint: 0, largestContentfulPaint: 0, cumulativeLayoutShift: 0 }, recommendations: [] },
            seo: { score: item.seoScore || 0, issues: [], recommendations: [] },
            accessibility: { score: item.accessibilityScore || 0, violations: [], recommendations: [] },
            design: { score: item.designScore || 0, analysis: { colorContrast: 0, typography: 0, layout: 0, responsiveness: 0 }, recommendations: [] },
            ux: { score: item.uxScore || 0, metrics: { navigationClarity: 0, contentReadability: 0, mobileUsability: 0, interactionDesign: 0 }, recommendations: [] }
          }
        }
      })
      
      setHistory(parsedHistory)
    } catch (error) {
      console.error('Failed to load history:', error)
      toast.error('Failed to load analysis history')
    }
  }, [user])

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setLoading(state.isLoading)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (user) {
      loadHistory()
    }
  }, [user, loadHistory])

  const analyzeWebsite = async () => {
    if (!url.trim()) {
      toast.error('Please enter a valid URL')
      return
    }

    // Validate URL format
    let validUrl = url
    try {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        validUrl = `https://${url}`
      }
      new URL(validUrl)
    } catch {
      toast.error('Please enter a valid URL')
      return
    }

    setAnalyzing(true)
    setProgress(0)
    setResult(null)

    try {
      // Step 1: Scrape website content
      setCurrentStep('Analyzing website content...')
      setProgress(20)
      
      const { markdown, metadata } = await blink.data.scrape(validUrl)
      
      // Step 2: Take screenshot for visual analysis
      setCurrentStep('Capturing website screenshot...')
      setProgress(40)
      
      const screenshotUrl = await blink.data.screenshot(validUrl, {
        fullPage: true,
        width: 1920,
        height: 1080
      })

      // Step 3: AI Analysis
      setCurrentStep('Running AI analysis...')
      setProgress(60)

      const analysisPrompt = `
        Analyze this website comprehensively and provide detailed insights:
        
        URL: ${validUrl}
        Title: ${metadata.title || 'No title'}
        Description: ${metadata.description || 'No description'}
        
        Content Preview:
        ${markdown.substring(0, 2000)}...
        
        Please analyze and score (0-100) the following areas:
        1. Performance (load speed, optimization)
        2. SEO (meta tags, structure, content)
        3. Accessibility (WCAG compliance, usability)
        4. Design (visual appeal, consistency, branding)
        5. User Experience (navigation, content clarity, mobile-friendliness)
        
        For each area, provide specific recommendations for improvement.
        Also identify any critical issues that need immediate attention.
        
        Provide realistic scores and detailed, actionable recommendations.
      `

      const { object: analysis } = await blink.ai.generateObject({
        prompt: analysisPrompt,
        schema: {
          type: 'object',
          properties: {
            performance: {
              type: 'object',
              properties: {
                score: { type: 'number' },
                metrics: {
                  type: 'object',
                  properties: {
                    loadTime: { type: 'number' },
                    firstContentfulPaint: { type: 'number' },
                    largestContentfulPaint: { type: 'number' },
                    cumulativeLayoutShift: { type: 'number' }
                  }
                },
                recommendations: { type: 'array', items: { type: 'string' } }
              }
            },
            seo: {
              type: 'object',
              properties: {
                score: { type: 'number' },
                issues: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string' },
                      message: { type: 'string' },
                      impact: { type: 'string' }
                    }
                  }
                },
                recommendations: { type: 'array', items: { type: 'string' } }
              }
            },
            accessibility: {
              type: 'object',
              properties: {
                score: { type: 'number' },
                violations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      severity: { type: 'string' },
                      description: { type: 'string' },
                      element: { type: 'string' }
                    }
                  }
                },
                recommendations: { type: 'array', items: { type: 'string' } }
              }
            },
            design: {
              type: 'object',
              properties: {
                score: { type: 'number' },
                analysis: {
                  type: 'object',
                  properties: {
                    colorContrast: { type: 'number' },
                    typography: { type: 'number' },
                    layout: { type: 'number' },
                    responsiveness: { type: 'number' }
                  }
                },
                recommendations: { type: 'array', items: { type: 'string' } }
              }
            },
            ux: {
              type: 'object',
              properties: {
                score: { type: 'number' },
                metrics: {
                  type: 'object',
                  properties: {
                    navigationClarity: { type: 'number' },
                    contentReadability: { type: 'number' },
                    mobileUsability: { type: 'number' },
                    interactionDesign: { type: 'number' }
                  }
                },
                recommendations: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      })

      // Step 4: Save results
      setCurrentStep('Saving analysis results...')
      setProgress(80)

      const analysisResult: AnalysisResult = {
        id: `analysis_${Date.now()}`,
        url: validUrl,
        timestamp: Date.now(),
        ...analysis
      }

      // Save to database
      await blink.db.websiteAnalyses.create({
        id: analysisResult.id,
        userId: user.id,
        url: analysisResult.url,
        timestamp: analysisResult.timestamp,
        performanceScore: analysisResult.performance.score,
        seoScore: analysisResult.seo.score,
        accessibilityScore: analysisResult.accessibility.score,
        designScore: analysisResult.design.score,
        uxScore: analysisResult.ux.score,
        analysisData: JSON.stringify(analysisResult),
        createdAt: new Date().toISOString()
      })

      setProgress(100)
      setCurrentStep('Analysis complete!')
      setResult(analysisResult)
      
      // Refresh history
      await loadHistory()
      
      toast.success('Website analysis completed!')

    } catch (error) {
      console.error('Analysis failed:', error)
      toast.error('Analysis failed. Please try again.')
    } finally {
      setAnalyzing(false)
      setProgress(0)
      setCurrentStep('')
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" => {
    if (score >= 80) return 'default'
    if (score >= 60) return 'secondary'
    return 'destructive'
  }

  const loadHistoryItem = (item: AnalysisResult) => {
    setResult(item)
    setUrl(item.url)
  }

  const exportReport = () => {
    if (!result) return
    
    const reportData = {
      url: result.url,
      timestamp: new Date(result.timestamp).toISOString(),
      scores: {
        performance: result.performance.score,
        seo: result.seo.score,
        accessibility: result.accessibility.score,
        design: result.design.score,
        ux: result.ux.score,
        overall: Math.round((result.performance.score + result.seo.score + result.accessibility.score + result.design.score + result.ux.score) / 5)
      },
      analysis: result
    }
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `website-analysis-${new Date(result.timestamp).toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Report exported successfully!')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>AI Website Analyzer</CardTitle>
            <CardDescription>
              Sign in to analyze websites with AI-powered insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => blink.auth.login()} 
              className="w-full"
            >
              Sign In to Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <Globe className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">AI Website Analyzer</h1>
                <p className="text-sm text-muted-foreground">Comprehensive website insights powered by AI</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground hidden sm:block">Welcome, {user.email}</span>
              <Button variant="outline" size="sm" onClick={() => blink.auth.logout()}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Analysis Panel */}
          <div className="lg:col-span-3 space-y-6">
            {/* URL Input Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Search className="h-5 w-5" />
                  <span>Analyze Website</span>
                </CardTitle>
                <CardDescription>
                  Enter a website URL to get comprehensive AI-powered analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                  <Input
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !analyzing && analyzeWebsite()}
                    disabled={analyzing}
                    className="flex-1"
                  />
                  <Button 
                    onClick={analyzeWebsite} 
                    disabled={analyzing || !url.trim()}
                    className="px-8"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Analyzing
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Analyze
                      </>
                    )}
                  </Button>
                </div>

                {analyzing && (
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{currentStep}</span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Analysis Results */}
            {result && (
              <div className="space-y-6">
                {/* Overview Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="flex items-center justify-center mb-2">
                        <Zap className="h-5 w-5 text-orange-500" />
                      </div>
                      <div className={`text-2xl font-bold ${getScoreColor(result.performance.score)}`}>
                        {result.performance.score}
                      </div>
                      <div className="text-xs text-muted-foreground">Performance</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="flex items-center justify-center mb-2">
                        <TrendingUp className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className={`text-2xl font-bold ${getScoreColor(result.seo.score)}`}>
                        {result.seo.score}
                      </div>
                      <div className="text-xs text-muted-foreground">SEO</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="flex items-center justify-center mb-2">
                        <Shield className="h-5 w-5 text-green-500" />
                      </div>
                      <div className={`text-2xl font-bold ${getScoreColor(result.accessibility.score)}`}>
                        {result.accessibility.score}
                      </div>
                      <div className="text-xs text-muted-foreground">Accessibility</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="flex items-center justify-center mb-2">
                        <Palette className="h-5 w-5 text-purple-500" />
                      </div>
                      <div className={`text-2xl font-bold ${getScoreColor(result.design.score)}`}>
                        {result.design.score}
                      </div>
                      <div className="text-xs text-muted-foreground">Design</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="flex items-center justify-center mb-2">
                        <Users className="h-5 w-5 text-pink-500" />
                      </div>
                      <div className={`text-2xl font-bold ${getScoreColor(result.ux.score)}`}>
                        {result.ux.score}
                      </div>
                      <div className="text-xs text-muted-foreground">User Experience</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Analysis */}
                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
                      <div>
                        <CardTitle>Detailed Analysis</CardTitle>
                        <CardDescription>
                          Comprehensive insights and recommendations for {result.url}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                        <Button variant="outline" size="sm" onClick={exportReport}>
                          <Download className="h-4 w-4 mr-2" />
                          Export Report
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => window.open(result.url, '_blank')}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Visit Site
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="performance" className="w-full">
                      <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="performance">Performance</TabsTrigger>
                        <TabsTrigger value="seo">SEO</TabsTrigger>
                        <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
                        <TabsTrigger value="design">Design</TabsTrigger>
                        <TabsTrigger value="ux">UX</TabsTrigger>
                      </TabsList>

                      <TabsContent value="performance" className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Performance Analysis</h3>
                          <Badge variant={getScoreBadgeVariant(result.performance.score)}>
                            Score: {result.performance.score}/100
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground">Load Time</div>
                            <div className="text-lg font-semibold">{result.performance.metrics.loadTime}s</div>
                          </div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground">FCP</div>
                            <div className="text-lg font-semibold">{result.performance.metrics.firstContentfulPaint}s</div>
                          </div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground">LCP</div>
                            <div className="text-lg font-semibold">{result.performance.metrics.largestContentfulPaint}s</div>
                          </div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground">CLS</div>
                            <div className="text-lg font-semibold">{result.performance.metrics.cumulativeLayoutShift}</div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium mb-3">Recommendations</h4>
                          <div className="space-y-2">
                            {result.performance.recommendations.map((rec, index) => (
                              <Alert key={index}>
                                <CheckCircle className="h-4 w-4" />
                                <AlertDescription>{rec}</AlertDescription>
                              </Alert>
                            ))}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="seo" className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">SEO Analysis</h3>
                          <Badge variant={getScoreBadgeVariant(result.seo.score)}>
                            Score: {result.seo.score}/100
                          </Badge>
                        </div>

                        {result.seo.issues.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-3">Issues Found</h4>
                            <div className="space-y-2">
                              {result.seo.issues.map((issue, index) => (
                                <Alert key={index} variant={issue.type === 'error' ? 'destructive' : 'default'}>
                                  {issue.type === 'error' ? (
                                    <XCircle className="h-4 w-4" />
                                  ) : issue.type === 'warning' ? (
                                    <AlertTriangle className="h-4 w-4" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4" />
                                  )}
                                  <AlertDescription>
                                    <div className="flex items-center justify-between">
                                      <span>{issue.message}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {issue.impact} impact
                                      </Badge>
                                    </div>
                                  </AlertDescription>
                                </Alert>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <h4 className="font-medium mb-3">Recommendations</h4>
                          <div className="space-y-2">
                            {result.seo.recommendations.map((rec, index) => (
                              <Alert key={index}>
                                <CheckCircle className="h-4 w-4" />
                                <AlertDescription>{rec}</AlertDescription>
                              </Alert>
                            ))}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="accessibility" className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Accessibility Analysis</h3>
                          <Badge variant={getScoreBadgeVariant(result.accessibility.score)}>
                            Score: {result.accessibility.score}/100
                          </Badge>
                        </div>

                        {result.accessibility.violations.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-3">Violations</h4>
                            <div className="space-y-2">
                              {result.accessibility.violations.map((violation, index) => (
                                <Alert key={index} variant={violation.severity === 'critical' ? 'destructive' : 'default'}>
                                  {violation.severity === 'critical' ? (
                                    <XCircle className="h-4 w-4" />
                                  ) : (
                                    <AlertTriangle className="h-4 w-4" />
                                  )}
                                  <AlertDescription>
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span>{violation.description}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {violation.severity}
                                        </Badge>
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Element: {violation.element}
                                      </div>
                                    </div>
                                  </AlertDescription>
                                </Alert>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <h4 className="font-medium mb-3">Recommendations</h4>
                          <div className="space-y-2">
                            {result.accessibility.recommendations.map((rec, index) => (
                              <Alert key={index}>
                                <CheckCircle className="h-4 w-4" />
                                <AlertDescription>{rec}</AlertDescription>
                              </Alert>
                            ))}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="design" className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Design Analysis</h3>
                          <Badge variant={getScoreBadgeVariant(result.design.score)}>
                            Score: {result.design.score}/100
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground">Color Contrast</div>
                            <div className="text-lg font-semibold">{result.design.analysis.colorContrast}/100</div>
                          </div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground">Typography</div>
                            <div className="text-lg font-semibold">{result.design.analysis.typography}/100</div>
                          </div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground">Layout</div>
                            <div className="text-lg font-semibold">{result.design.analysis.layout}/100</div>
                          </div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground">Responsiveness</div>
                            <div className="text-lg font-semibold">{result.design.analysis.responsiveness}/100</div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium mb-3">Recommendations</h4>
                          <div className="space-y-2">
                            {result.design.recommendations.map((rec, index) => (
                              <Alert key={index}>
                                <CheckCircle className="h-4 w-4" />
                                <AlertDescription>{rec}</AlertDescription>
                              </Alert>
                            ))}
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="ux" className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">User Experience Analysis</h3>
                          <Badge variant={getScoreBadgeVariant(result.ux.score)}>
                            Score: {result.ux.score}/100
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground">Navigation</div>
                            <div className="text-lg font-semibold">{result.ux.metrics.navigationClarity}/100</div>
                          </div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground">Readability</div>
                            <div className="text-lg font-semibold">{result.ux.metrics.contentReadability}/100</div>
                          </div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground">Mobile</div>
                            <div className="text-lg font-semibold">{result.ux.metrics.mobileUsability}/100</div>
                          </div>
                          <div className="text-center p-3 bg-muted/50 rounded-lg">
                            <div className="text-sm text-muted-foreground">Interaction</div>
                            <div className="text-lg font-semibold">{result.ux.metrics.interactionDesign}/100</div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium mb-3">Recommendations</h4>
                          <div className="space-y-2">
                            {result.ux.recommendations.map((rec, index) => (
                              <Alert key={index}>
                                <CheckCircle className="h-4 w-4" />
                                <AlertDescription>{rec}</AlertDescription>
                              </Alert>
                            ))}
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Analysis History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <History className="h-5 w-5" />
                  <span>Recent Analyses</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No analyses yet. Start by analyzing your first website!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => loadHistoryItem(item)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium truncate">
                            {new URL(item.url).hostname}
                          </div>
                          <div className="flex items-center space-x-1">
                            <Star className="h-3 w-3 text-yellow-500" />
                            <span className="text-xs">
                              {Math.round((item.performance.score + item.seo.score + item.accessibility.score + item.design.score + item.ux.score) / 5)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          {new Date(item.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Analyses</span>
                  <span className="font-semibold">{history.length}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Average Score</span>
                  <span className="font-semibold">
                    {history.length > 0 
                      ? Math.round(
                          history.reduce((acc, item) => 
                            acc + (item.performance.score + item.seo.score + item.accessibility.score + item.design.score + item.ux.score) / 5, 0
                          ) / history.length
                        )
                      : 0
                    }
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Best Category</span>
                  <span className="font-semibold">
                    {history.length > 0 ? 'Design' : 'N/A'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App