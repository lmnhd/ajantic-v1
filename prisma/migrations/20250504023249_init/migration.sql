-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "profileImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "credits" TEXT DEFAULT '10',
    "googleResourceId" TEXT,
    "localGoogleId" TEXT,
    "tier" TEXT DEFAULT 'Free',
    "usecount" INTEGER NOT NULL DEFAULT 0,
    "stripeCheckoutSessionId" TEXT,
    "stripeCustomerId" TEXT,
    "subscriptionStart" TIMESTAMP(3),
    "subscriptionValid" BOOLEAN NOT NULL DEFAULT false,
    "lastUse" TIMESTAMP(3),
    "phone" TEXT,
    "fName" TEXT,
    "lName" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalGoogleCredential" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "folderId" TEXT,
    "pageToken" TEXT,
    "channelId" TEXT NOT NULL,
    "subscribed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "LocalGoogleCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormattedLyrics" (
    "id" SERIAL NOT NULL,
    "artist" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "lyrics" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "img" TEXT,

    CONSTRAINT "FormattedLyrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SummaryTemplates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "SummaryTemplates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AILyrics" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "lyrics" TEXT NOT NULL,
    "inspirations" TEXT[],
    "blockarized" TEXT,

    CONSTRAINT "AILyrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wordplay" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "example" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wordplay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchSong" (
    "id" SERIAL NOT NULL,
    "artist" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "lyrics" TEXT NOT NULL,
    "chorus" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "wordplays" INTEGER[],
    "img" TEXT,

    CONSTRAINT "ResearchSong_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongSets" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "songs" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongSets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongHistory" (
    "id" SERIAL NOT NULL,
    "songId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "songName" TEXT NOT NULL,
    "history" TEXT NOT NULL,
    "rules" TEXT[],
    "currentLine" TEXT NOT NULL,
    "currentBlock" TEXT NOT NULL,
    "currentSong" TEXT NOT NULL,
    "curBlockNum" INTEGER NOT NULL,
    "curLineNum" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SongHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneralPurpose" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta1" TEXT NOT NULL,
    "meta2" TEXT NOT NULL,
    "meta3" TEXT NOT NULL,

    CONSTRAINT "GeneralPurpose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppFreeze" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localState" TEXT NOT NULL,
    "currentConversation" TEXT NOT NULL DEFAULT '[]',
    "serverMessages" TEXT NOT NULL DEFAULT '[]',
    "orchestrationState" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppFreeze_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerMessage" (
    "id" SERIAL NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "subMessages" TEXT NOT NULL,
    "currentState" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "contextSets" TEXT NOT NULL,
    "conversationLevel" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" SERIAL NOT NULL,
    "dayName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messages" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LastConversationDayName" (
    "id" SERIAL NOT NULL,
    "dayName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LastConversationDayName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "objectives" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineSet" (
    "id" SERIAL NOT NULL,
    "setName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "lines" TEXT NOT NULL,
    "teamId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextContainerProps" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "setName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "lines" TEXT NOT NULL,
    "teamId" INTEGER,
    "fullScreen" BOOLEAN NOT NULL DEFAULT false,
    "hiddenFromAgents" TEXT[],
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "formSchema" TEXT,
    "contextSetId" INTEGER,

    CONSTRAINT "ContextContainerProps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextSet" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" INTEGER,

    CONSTRAINT "ContextSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentComponent" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleDescription" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "systemPrompt" TEXT,
    "modelProvider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tools" TEXT[],
    "voice" JSONB,
    "promptDirectives" TEXT[],
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "training" BOOLEAN NOT NULL DEFAULT false,
    "teamId" INTEGER,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomTool" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parameters" TEXT NOT NULL,
    "implementation" TEXT NOT NULL,
    "implementationType" TEXT NOT NULL DEFAULT 'function',
    "metadata" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCredential" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "credentialName" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleResourceId_key" ON "User"("googleResourceId");

-- CreateIndex
CREATE UNIQUE INDEX "User_localGoogleId_key" ON "User"("localGoogleId");

-- CreateIndex
CREATE UNIQUE INDEX "LocalGoogleCredential_accessToken_key" ON "LocalGoogleCredential"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "LocalGoogleCredential_channelId_key" ON "LocalGoogleCredential"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "LocalGoogleCredential_userId_key" ON "LocalGoogleCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SummaryTemplates_name_key" ON "SummaryTemplates"("name");

-- CreateIndex
CREATE INDEX "LineSet_teamId_idx" ON "LineSet"("teamId");

-- CreateIndex
CREATE INDEX "ContextContainerProps_contextSetId_idx" ON "ContextContainerProps"("contextSetId");

-- CreateIndex
CREATE UNIQUE INDEX "ContextSet_teamId_key" ON "ContextSet"("teamId");

-- CreateIndex
CREATE INDEX "ContextSet_teamId_idx" ON "ContextSet"("teamId");

-- CreateIndex
CREATE INDEX "AgentComponent_teamId_idx" ON "AgentComponent"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentComponent_teamId_name_key" ON "AgentComponent"("teamId", "name");

-- CreateIndex
CREATE INDEX "CustomTool_name_idx" ON "CustomTool"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CustomTool_userId_name_key" ON "CustomTool"("userId", "name");

-- CreateIndex
CREATE INDEX "UserCredential_userId_idx" ON "UserCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCredential_userId_credentialName_key" ON "UserCredential"("userId", "credentialName");
