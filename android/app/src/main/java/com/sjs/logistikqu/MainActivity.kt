package com.sjs.logistikqu

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.fragment.app.FragmentActivity
import androidx.navigation.compose.rememberNavController
import com.sjs.logistikqu.presentation.navigation.LogistikQuNavGraph
import com.sjs.logistikqu.presentation.theme.LogistikQuTheme
import com.sjs.logistikqu.security.SecurityManager
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : FragmentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Apply Enterprise Security: Screenshot & Screen Recording Protection (FLAG_SECURE)
        SecurityManager.applyWindowSecurity(this)

        setContent {
            LogistikQuTheme {
                val navController = rememberNavController()
                LogistikQuNavGraph(navController = navController)
            }
        }
    }
}
