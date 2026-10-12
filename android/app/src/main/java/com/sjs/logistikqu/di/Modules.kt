package com.sjs.logistikqu.di

import android.content.Context
import androidx.room.Room
import com.sjs.logistikqu.data.api.AuthInterceptor
import com.sjs.logistikqu.data.api.LogistikQuApiService
import com.sjs.logistikqu.data.database.LogistikQuDatabase
import com.sjs.logistikqu.data.database.dao.InventoryCacheDao
import com.sjs.logistikqu.data.database.dao.LocalTransactionDao
import com.sjs.logistikqu.data.database.dao.PhotoUploadQueueDao
import com.sjs.logistikqu.data.database.dao.SyncQueueDao
import com.sjs.logistikqu.data.repository.*
import com.sjs.logistikqu.domain.repository.*
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.Dns
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.net.InetAddress
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    private const val BASE_URL = "https://logistik.sjsgroup.online/"

    @Provides
    @Singleton
    fun provideOkHttpClient(authInterceptor: AuthInterceptor): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        // Resilient DNS: fallback to known Cloudflare Anycast IPs if carrier DNS fails resolution
        val resilientDns = object : Dns {
            override fun lookup(hostname: String): List<InetAddress> {
                return try {
                    Dns.SYSTEM.lookup(hostname)
                } catch (e: UnknownHostException) {
                    if (hostname.equals("logistik.sjsgroup.online", ignoreCase = true)) {
                        listOf(
                            InetAddress.getByName("104.21.11.250"),
                            InetAddress.getByName("172.67.150.207")
                        )
                    } else {
                        throw e
                    }
                }
            }
        }

        return OkHttpClient.Builder()
            .dns(resilientDns)
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideApiService(retrofit: Retrofit): LogistikQuApiService {
        return retrofit.create(LogistikQuApiService::class.java)
    }
}

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): LogistikQuDatabase {
        return Room.databaseBuilder(
            context,
            LogistikQuDatabase::class.java,
            "logistikqu_mining.db"
        )
        .fallbackToDestructiveMigration()
        .build()
    }

    @Provides
    fun provideSyncQueueDao(database: LogistikQuDatabase): SyncQueueDao = database.syncQueueDao()

    @Provides
    fun provideInventoryCacheDao(database: LogistikQuDatabase): InventoryCacheDao = database.inventoryCacheDao()

    @Provides
    fun provideLocalTransactionDao(database: LogistikQuDatabase): LocalTransactionDao = database.localTransactionDao()

    @Provides
    fun providePhotoUploadQueueDao(database: LogistikQuDatabase): PhotoUploadQueueDao = database.photoUploadQueueDao()
}

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindAuthRepository(impl: AuthRepositoryImpl): AuthRepository

    @Binds
    @Singleton
    abstract fun bindInventoryRepository(impl: InventoryRepositoryImpl): InventoryRepository

    @Binds
    @Singleton
    abstract fun bindIssueRepository(impl: IssueRepositoryImpl): IssueRepository

    @Binds
    @Singleton
    abstract fun bindReceiveRepository(impl: ReceiveRepositoryImpl): ReceiveRepository

    @Binds
    @Singleton
    abstract fun bindTransferRepository(impl: TransferRepositoryImpl): TransferRepository

    @Binds
    @Singleton
    abstract fun bindSyncRepository(impl: SyncRepositoryImpl): SyncRepository

    @Binds
    @Singleton
    abstract fun bindReplenishmentRepository(impl: ReplenishmentRepositoryImpl): ReplenishmentRepository
}
