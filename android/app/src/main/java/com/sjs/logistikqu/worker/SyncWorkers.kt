package com.sjs.logistikqu.worker

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.*
import com.sjs.logistikqu.domain.repository.SyncRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit

@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val syncRepository: SyncRepository
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        const val MAX_RETRIES = 5
    }

    override suspend fun doWork(): Result {
        return try {
            val syncResult = syncRepository.processPendingQueue()
            if (syncResult.isSuccess) {
                val resultData = syncResult.getOrNull()
                // If there are failures in the batch and we haven't reached max retries, retry with exponential backoff
                if (resultData != null && resultData.failedCount > 0 && runAttemptCount < MAX_RETRIES) {
                    Result.retry()
                } else {
                    val outputData = Data.Builder()
                        .putInt("success_count", resultData?.successCount ?: 0)
                        .putInt("failed_count", resultData?.failedCount ?: 0)
                        .putInt("conflict_count", resultData?.conflictCount ?: 0)
                        .build()
                    Result.success(outputData)
                }
            } else {
                if (runAttemptCount < MAX_RETRIES) {
                    Result.retry()
                } else {
                    Result.failure()
                }
            }
        } catch (e: Exception) {
            if (runAttemptCount < MAX_RETRIES) {
                Result.retry()
            } else {
                Result.failure()
            }
        }
    }
}

object SyncScheduler {

    const val PERIODIC_SYNC_WORK_NAME = "logistikqu_periodic_sync"
    const val ONE_TIME_SYNC_WORK_NAME = "logistikqu_immediate_sync"

    /**
     * Schedules periodic background sync (every 15 minutes) when connected to network.
     * Uses Exponential Backoff policy starting from 1 minute up to 5 attempts.
     */
    fun schedulePeriodicSync(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val periodicWork = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                1,
                TimeUnit.MINUTES
            )
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            PERIODIC_SYNC_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            periodicWork
        )
    }

    /**
     * Triggers an immediate one-time background sync when connected to network.
     */
    fun triggerImmediateSync(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val oneTimeWork = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                30,
                TimeUnit.SECONDS
            )
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            ONE_TIME_SYNC_WORK_NAME,
            ExistingWorkPolicy.REPLACE,
            oneTimeWork
        )
    }

    /**
     * Cancels any active or scheduled sync workers.
     */
    fun cancelAllSync(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(PERIODIC_SYNC_WORK_NAME)
        WorkManager.getInstance(context).cancelUniqueWork(ONE_TIME_SYNC_WORK_NAME)
    }
}
